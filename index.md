# Weather API in OCaml


I enjoyed Peter Bourgon's [How I Start](http://howistart.org/posts/go/1), Go seemed easy and fun. It made me wonder, how fun or easy would it be in OCaml? The only one way to find out is to do it!  (This post is not an OCaml tutorial, but I hope it gives an idea of what writing code in OCaml is like).    


_Note: I've copied a lot from the original post, ideas and words. Any mistake or error are my own._


## What is OCaml ?

OCaml belongs to the ML language family (whose roots go back to the 70's), it has been used  in compilers, static analysis tools, and proof systems.
It is typed, functional with some imperative features, has a powerful module system, and an object system.

OCaml is not super trendy. Yet recently, a great introductory [book](https://realworldocaml.org/) came out, and a new [website](http://ocaml.org/) launched. It's also made the news ([Coq](http://awards.acm.org/software_system/), [Hack](https://code.facebook.com/posts/264544830379293/hack-a-new-programming-language-for-hhvm/) and [Flow](https://code.facebook.com/posts/1505962329687926/flow-a-new-static-type-checker-for-javascript/)).



Let's use OCaml to build a backend service for a web app.

1. [Setting up your environment](#setting-up-your-environment)
1. [A new project](#a-new-project)
1. [Making a web server](#making-a-web-server)
1. [Adding more routes](#adding-more-routes)
1. [Querying multiple APIs](#querying-multiple-apis)
1. [Conclusion](#conclusion)
1. [Further exercises](#further-exercises)

## Setting up your environment

The first step is, of course, to install [OCaml and OPAM](http://opam.ocaml.org/doc/Quick_Install.html) (a package manager for OCaml). 

Here's how to go about it, on a recent Ubuntu:

```
$ sudo apt-get install software-properties-common 
$ sudo apt-get install m4 
$ sudo apt-get install make
$ sudo add-apt-repository ppa:avsm/ppa
$ sudo apt-get update
$ sudo apt-get install ocaml ocaml-native-compilers camlp4-extra opam
$ opam init
```

 Once you're done, this should work:
 
```
$ ocaml -version
The OCaml toplevel, version 4.02.1
```


There are a few options for editing OCaml code (Emacs, Vim, SublimeText, and [more](https://code.facebook.com/posts/1505962329687926/flow-a-new-static-type-checker-for-javascript/))
Personally, I use Emacs with [tuareg](https://github.com/ocaml/tuareg) and [merlin](https://github.com/the-lambda-church/merlin)

OCaml includes a bare bones top level, but you can use [utop](https://github.com/diml/utop), for a more capable one.


## A new project

Create `hello.ml`, this will be our simplest OCaml program.

```ocaml
let _ = print_endline "hello!"
```
Compile and run:

```
$ ocamlbuild hello.native
$ ./hello.native
hello!
```

Easy!

## Making a web server

Let's turn our "hello" program into a web server.

Because the HTTP library I'm using ([CoHTTP](https://github.com/mirage/ocaml-cohttp)) only support async code, we'll go straight into an asynchronous web server. With CoHTTP, we'll be using [Lwt](http://ocsigen.org/lwt/), a cooperative threads library.

to install these two, do :

```
$ apt-get install libssl-dev
$ opam install lwt.2.4.6 cohttp.0.12.0
```

This should pull in all required dependencies

Here's the full program for a simple 'hello' server.
     
```ocaml
open Lwt
open Cohttp
open Cohttp_lwt_unix

let make_server () =
  let callback conn_id req body =
    let uri = Request.uri req in
    match Uri.path uri with
    | "/" -> Server.respond_string ~status:`OK ~body:"hello!\n" ()
    | _ -> Server.respond_string ~status:`Not_found ~body:"Route not found" ()
  in
  let conn_closed conn_id () = () in
  Server.create { Server.callback; Server.conn_closed }

let _ =
  Lwt_unix.run (make_server ())
```

First, we open 3 modules, so we can use unqualified identifiers (for instance, `Request.uri` instead of `Cohttp.Request.uri`):

In `make_server()`, we create a server configured by 2 handler functions: `callback` to handle the request, and `conn_closed` to handle the end of the connection (here, we chose to do nothing).

callback takes a connection id, an HTTP request and a body. It dispatches on the request uri: "/" gets a hello response, anything else gets a 404.

the last expression is the program main entry,  `make_server` returns an Lwt thread.
`Lwt_unix.run` runs this thread until it terminates

To compile this program, we first create the following _tag file:

```
true: package(lwt), package(cohttp), package(cohttp.lwt)
```
It lists all the packages we're depending on
Now that ocamlbuild can find the libraries we're using, we compile and run:

```
$ ocamlbuild -use-ocamlfind hello_server.native
$ ./hello_server.native
```

To interact with the server, in another terminal or your browser, make an HTTP request:

```
$ curl http://localhost:8080
hello!
```

That wasn't too bad!

## Adding more routes

We can do something more interesting than just say hello.

Let's take a city as input, call out to a weather API, and forward a response with the temperature.
The [OpenWeatherMap](http://openweathermap.org/)
 provides a [simple and free API](http://openweathermap.org/api)
 for [current forecast info](http://openweathermap.org/current),
 which we can [query by city](http://api.openweathermap.org/data/2.5/weather?q=Tokyo).
It returns responses like this (partially redacted):

```json
{
    "name": "Tokyo",
    "coord": {
        "lon": 139.69,
        "lat": 35.69
    },
    "weather": [
        {
            "id": 803,
            "main": "Clouds",
            "description": "broken clouds",
            "icon": "04n"
        }
    ],
    "main": {
        "temp": 296.69,
        "pressure": 1014,
        "humidity": 83,
        "temp_min": 295.37,
        "temp_max": 298.15
    }
}
```

To stay close to the original Go code, we'll use [atdgen](https://github.com/mjambon/atdgen), a tool that generate OCaml code to (de)serialize JSON (a more light-weight alternative would be to directly use a JSON library like [yojson](https://github.com/mjambon/yojson)).    

First, let's install atdgen:

```
$ opam install atdgen
```

Next, in `openweathermap.atd`, we'll define the following types to specify what we want to deserialize from the JSON response:

```
type main = { temp: float }
type weather = { main: main; name: string }
```

We can now use `atdgen` to generate the OCaml code: 

```
atdgen -t openweathermap.atd
atdgen -j openweathermap.atd
```

This creates 2 OCaml modules: `Openweathermap_t` and `Openweathermap_j`.
Which we can use like this:

```ocaml
let weather = Openweathermap_j.weather_of_string response in ...
```

Now let's write a function to query the API:

```ocaml
let query city = 
  let open Openweathermap_j in
  Client.get (Uri.of_string 
    ("http://api.openweathermap.org/data/2.5/weather?q=" ^ city))
  >>= fun (_, body) -> Cohttp_lwt_body.to_string body
  >>= fun s -> return (string_of_weather (weather_of_string s))

```

Writing asynchronous code with LWT is done by combining operations with the `>>=` operator. 

In `f >>= fun x -> g x`, `g` is a "callback" which runs after `f` has completed, with the result of `f` (here bound to `x`) as input". 

For example, when in OCaml we write:
```
(Client.get uri) >>= fun (_, body) -> to_string body
```
in Javascript, we would write:

```
Client.get(uri, function(_, body){ return to_string(body); })
```

See this [LWT tutorial](http://openmirage.org/wiki/tutorial-lwt) for more. 
 

Here's the complete program:

```ocaml
open Lwt
open Cohttp
open Cohttp_lwt_unix

    
let query city = 
  let open Openweathermap_j in
  Client.get (Uri.of_string 
    ("http://api.openweathermap.org/data/2.5/weather?q=" ^ city))
  >>= fun (_, body) -> Cohttp_lwt_body.to_string body
  >>= fun s -> return (string_of_weather (weather_of_string s))

let make_server () =
 let callback conn_id req body =
  let uri = Request.uri req in
  match Re_str.(split_delim (regexp_string "/") (Uri.path uri)) with
  | ""::"weather"::city::_ -> query city >>= fun json ->
     let headers = 
       Header.init_with "content-type" "application/json; charset=utf-8" in
     Server.respond_string ~headers ~status:`OK ~body:json ()
  | _ ->
    Server.respond_string ~status:`Not_found ~body:"Route not found" ()
 in
 let conn_closed conn_id () = () in
 Server.create { Server.callback; Server.conn_closed }


let _ = 
  Lwt_unix.run (make_server ())
```

In our server handler, we match uri of the form "/weather/city" to an API call, and returns the temperature as JSON.

Now we'll update the `_tags` file with our new dependencies:

```
true: package(lwt), package(cohttp), package(cohttp.lwt), package(atdgen), package(yojson), package(re.str)
```

Build and run, as before.

```
$ ocamlbuild -use-ocamlfind weather.native
$ ./weather.native
```

```
curl http://localhost:8080/weather/tokyo
{"main":{"temp":285.92},"name":"Tokyo"}
```

## Querying multiple APIs

Maybe we can build a more accurate temperature for a city, by querying and averaging multiple weather APIs.
Unfortunately for us, most weather APIs require authentication.
So, get yourself an API key for [Weather Underground](http://www.wunderground.com/weather/api).

Since we want the same behavior from all of our weather providers, we're going to encode this in a module signature:

```ocaml
module type Weather = sig
    (** get city's temperature in kelvin *)
    val get_temp : city:string -> float Lwt.t
end
```

Now, we can provide our old OpenWeatherMap query function in a module that satisfies this signature.

And we'll add a simple line of logging, so we can see what's happening.

```ocaml
(** OpenWeatherMap Provider *)
module OpenWeatherMap : Weather = struct
  open Openweathermap_j
  
  let get_temp ~city = 
  Client.get (Uri.of_string 
    ("http://api.openweathermap.org/data/2.5/weather?q=" ^ city))
  >>= fun (_, body) -> Cohttp_lwt_body.to_string body
  >>= fun s -> 
    let w = weather_of_string s in 
    let temp = w.main.temp in
    Lwt_io.printf "openWeatherMap: %s: %.2f\n" city temp 
  >>= fun _ -> return temp
  
end

```

Let's do the same for the Weather Underground.

Here's how the response looks (partially redacted):

```
{
  "response": {
    "version": "0.1",
    "termsofService": "http://www.wunderground.com/weather/api/d/terms.html",
    "features": {
    "conditions": 1
    }
  },
  "current_observation": {
  ...
  "estimated": {},
  "station_id": "KCASANFR58",
  "observation_time": "Last Updated on June 27, 5:27 PM PDT",
  "observation_time_rfc822": "Wed, 27 Jun 2012 17:27:13 -0700",
  "observation_epoch": "1340843233",
  "local_time_rfc822": "Wed, 27 Jun 2012 17:27:14 -0700",
  "local_epoch": "1340843234",
  "local_tz_short": "PDT",
  "local_tz_long": "America/Los_Angeles",
  "local_tz_offset": "-0700",
  "weather": "Partly Cloudy",
  "temperature_string": "66.3 F (19.1 C)",
  "temp_f": 66.3,
  "temp_c": 19.1,
  ...
  }
}
```

First let's define a new atdgen specification in `weatherunderground.atd`, just to get at `temp_c`:

```
type current_observation = { temp_c: float }
type conditions = { current_observation: current_observation }
```

and like before, we generate the OCaml code:

```
atdgen -t weatherunderground.atd
atdgen -j weatherunderground.atd
```

We also need to provide an API key.
We'll define the key in the module, and use it in the `get_temp` function.

(Note that the Weather Underground doesn't disambiguate cities quite as nicely as OpenWeatherMap.
We're skipping some important logic to handle ambiguous city names for the purposes of the example.)

```ocaml
(** WeatherUnderground Provider *)
module WeatherUnderground : Weather = struct
  open Weatherunderground_j
  
  let key = "..." (* your WU API key *)
  
  let kelvin_of_celsius t = t +. 273.15
  
  let get_temp ~city = 
  Client.get (Uri.of_string ("http://api.wunderground.com/api/" ^ 
    key ^ "/conditions/q/" ^ city ^ ".json"))
  >>= fun (_, body) -> Cohttp_lwt_body.to_string body
  >>= fun s -> 
    let c = conditions_of_string s in 
    let temp = kelvin_of_celsius c.current_observation.temp_c in
    Lwt_io.printf "WeatherUnderground: %s: %.2f\n" city temp 
  >>= fun _ -> return temp
  
end

```

Now that we have a couple of weather providers, let's write a function to query them all, and return the average temperature.

For simplicity, if we encounter any errors, we'll just give up. IS IT TRUE ?

First we'll install `core`, to use its `Time` module (Core is a modernized OCaml standard library from Jane Street). Be aware that installing it can take a few minutes...

```
$ opam install core
```

Next, in `response.atd`, we'll define a type to describe the JSON response.

```
type response = { city: string; temp: float; took: string; }
```

Again, we generate the boilerplate OCaml code:

```
$ atdgen -t response.atd
$ atdgen -j response.atd
```

Now let's write the function `temperature`. 
It takes a city name and a list of provider functions
looking at their type, val get_temp : city:string -> float Lwt.t

```ocaml
let average xs =
  let sum = List.fold_left (+.) 0. xs in
  (sum /. float_of_int (List.length xs))
    

let temperature ~city ~providers =
  let open Response_j in 
  let open Core.Std in
    let t0 = Time.now () in
    Lwt_list.map_p (fun get_temp -> get_temp ~city) providers >>= 
      fun temps -> 
        let t1 = Time.now () in
        let response = { city = city; temp = average temps; 
                         took = Core.Span.to_string (Time.diff t1 t0); }
        in return (string_of_response response)
```

We use `Lwt_list.map_p` to fire off queries in parallel.
Once the longest queries is finished, we return the average temperature
and the time it took. 

Notice that the function definition is very close to the weatherProvider temperature method.
If we collect the individual weatherProviders into a type, and define the temperature method on that type,
we can implement a meta-weatherProvider, comprised of other weatherProviders.


Now, we can wire that up to our HTTP server.

```
let make_server temp =
 let callback conn_id req body =
  let uri = Request.uri req in
  match Re_str.(split_delim (regexp_string "/") (Uri.path uri)) with
  | ""::"weather"::city::_ -> temp ~city >>= fun json ->
     let headers = 
       Header.init_with "content-type" "application/json; charset=utf-8" in
     Server.respond_string ~headers ~status:`OK ~body:json ()
  | _ ->
    Server.respond_string ~status:`Not_found ~body:"Route not found" ()
 in
 let conn_closed conn_id () = () in
 Server.create { Server.callback; Server.conn_closed }


let _ = 
  let providers = [OpenWeatherMap.get_temp; WeatherUnderground.get_temp;] 
  in Lwt_unix.run (make_server (temperature ~providers))
```

Note that we pass a partially applied `temperature` function to `make_server`.

Now we'll update our `_tags` file:

```
true: package(core), package(lwt), package(cohttp), package(cohttp.lwt), package(atdgen), package(yojson), package(re.str), thread
```

Finally we compile, run, and GET, just as before.
In addition to the JSON response, you'll see the following output.

```
$ ./weather.native
openWeatherMap: tokyo: 287.11
WeatherUnderground: tokyo: 288.15
```

```
$ curl http://localhost/weather/tokyo
{"city":"tokyo","temp":287.63,"took":"611.787ms"}
```

## Conclusion 

So in the end, was it as easy and fun as Go ?

Well... I have to admit that OCaml is much less "batteries included" than Go: we had to install libraries for the http server, JSON serialization, and even time operations.

Also building the program is more involved.

The concurrent code with LWT takes some time to get used to, but I am not familiar enough with Go's concurrency to judge which one is easier.

So probably not as easy overall... 

I did have fun though :)


## Further exercises

[Fork](https://github.com/voila/weather-api-ocaml) the final code on github.

Can you add some error handling (for instance, can you prevent the failure of one weather provider from aborting the whole computation) ?

Can you add another weather provider? (Hint: [forecast.io](https://developer.forecast.io/) is a good one)

Can you implement a timeout?