//var assert = require('assert');
//var util = require('util');

var assert = {deepEqual: function(a,b){}, equal: function(a,b){}, ok: function(a,b){}}
var util = { inspect: function(x,y) { return x }}

// terms (representation should be hidden via this API)
function v(id) {
    return  {type: 'var', id: id }; 
}

function a(id, params) {
    return  {type: 'atom', id: id, params: params}; 
}

function c(id){
    return {type: 'const', id: id};
}

function is_v(t) { return t.type == 'var'; }
function is_a(t) { return t.type == 'atom'; }
function is_c(t) { return t.type == 'const'; }

function is_cons(t) { return t.id == 'cons'; }
function is_nil(t) { return t.id == 'nil'; }
function is_list(t) { return t.id == 'nil' || t.id == "cons"; }

function tid(t) {return t.id; }
function ttype(t) {return t.type; }
function params(t) {return t.params; }


function pprintList(t){
    if(is_nil(t))
        return ''
    else if(is_nil(t.params[1]))
        return pprint(t.params[0]);
    else
        return pprint(t.params[0]) + ', ' + pprintList(t.params[1]);
}

function pprint(t){
    switch(t.type){
        case 'atom':
          if(is_list(t))
              return '[' + pprintList(t) + ']'; 
          else 
              return t.id + '(' + 
              t.params.map(function(t){ return pprint(t); }) + 
              ')';
        default:
           return t.id;
    }
}

// ------------------------------------------------------
// a substitution is a list of (string, term) pairs

function lookup(t, subst){
    var id = tid(t);
    for(var i=0; i<subst.length; i++){
        if(subst[i][0] === id)
            return subst[i][1];
    }
    return t;
}


assert.deepEqual(lookup(v('z'),[['x',a('h',[v('x')])],
                            ['y',v('y')],
                            ['z', a('g',[v('x'), c('a')])]]), 
             a('g',[v('x'), c('a')]));
assert.deepEqual(lookup(v('u'),[['x',a('h',[v('x')])],
                            ['y',v('y')],
                            ['z', a('g',[v('x'), c('a')])]]), 
             v('u'));

 


var subst0 = []; // the empty substitution

function fst(l){ return l[0]; }
function snd(l){ return l[1]; }
function rest(l){ return l.slice(1); }

// ------------------------------------------------------



// term equality
function teq(t1, t2){
    if(tid(t1) != tid(t2) || ttype(t1) != ttype(t2)) return false;  
    if(is_a(t1)) {
        var par1 = params(t1), par2= params(t2);
        //if(par1.length != par2.length) return false;
        for(var i=0; i<par1.length; i++){
            if(!teq(par1[i], par2[i])) return false;
        }
    }
    return true;
}

assert.ok(teq(v('X'),v('X')));
assert.equal(teq(v('Y'),v('X')), false);
assert.ok(teq(a('test',[c('nil')]), a('test',[c('nil')])));
assert.equal(teq(a('test',[c('nil')]), a('test',[c('a'), c('b')])), false);
assert.equal(teq(a('test',[c('nil')]), a('test',[c('a')])), false);


function member(eq, x, l) {
    for(var i=0; i<l.length; i++){
        if(eq(x,l[i]))
           return true;
    }
    return false;
}

function renameTerm_(t){
    if(is_v(t) && tid(t) === '_') 
        return v(fresh()); 
    if(is_v(t) || is_c(t))
        return t;
    if(is_a(t))
        return a(tid(t), t.params.map(function(t){ return renameTerm_(t); }));
}

// return the list of vars in term t
function termVars(t){
//  if(is_v(t) && tid(t) === "_")
//      return [v(fresh())];
  if(is_v(t))
      return [t];
  if(is_c(t))
      return [];
  if(is_a(t))
      return t.params
        .map(function(t){ return termVars(t); })
        .reduce(function(l1, l2){ return l1.concat(l2); });
}

var t1 = termVars(v('X'));
assert.deepEqual(t1, [v('X')]);
t1 = termVars(a('cons',[v('X'), c('nil')]));
assert.deepEqual(t1, [v('X')]);

function substitute(t, subst){
//    if(is_v(t) && tid(v) == '_')
//        return v(fresh());
    if(is_v(t))
        return lookup(t, subst);
    if(is_c(t))
        return t;
    if(is_a(t))
        return a(tid(t), params(t).map(function(t){ return substitute(t, subst); }));
}

assert.deepEqual(
    substitute(a('f',[v('x'), a('g',[v('y'), a('h',[a('h',[v('x')])])]), v('z')]),
              [['x',a('h', [v('y')])], ['z', a('g', [v('x'), c('a')])]]),
    a('f',[a('h', [v('y')]),
           a('g', [v('y'), a('h', [a('h', [a('h', [v('y')])])])]),
           a('g',[v('x'), c('a')])]));


// returns a list of variables which are not paired with themselves
function domSubst(subst){
    return subst.map(
        function(p){
            var id = fst(p);
            return teq(snd(p), v(id)) ? [] : [v(id)];
        }).reduce(function(l1,l2){ return l1.concat(l2); }, [])
}

assert.deepEqual(
    domSubst([['x', a('h', [v('x')])], 
              ['y', v('y')], 
              ['z', a('g', [v('x'), c('a')])]]),
    [v('x'),v('z')]
);

function union(l1,l2){
  if(l1.length == 0)
      return l2;
  if(member(teq, fst(l1), l2))
     return union(rest(l1), l2);
  return union(rest(l1), l2.concat([fst(l1)]));
}

assert.deepEqual(
    union([v('x')],[v('x')]),
    [v('x')]
);
assert.deepEqual(
    union([v('x')],[v('y')]),
    [v('y'),v('x')]
);

function compSubst(subst1,subst2){
    //console.log("compSubst", subst1, subst2);
    var d1 = domSubst(subst1);
    var d2 = domSubst(subst2);
    var u = union(d1, d2);
    var res =  
        u.map(function(x){ 
            var subst = substitute(lookup(x, subst1), subst2);
            return [tid(x), subst];
        });

    //console.log("compSubst res", res);

    return res;
}


assert.deepEqual(
   compSubst(
        [['x', a('h', [c('b')])], ['y', a('f', [v('x'), v('y'), v('z')])]],
        [['x', a('h', [v('x')])], ['z', a('g', [v('x'), c('a')])]]
   ), 
    [['x', a('h', [c('b')])], ['z', a('g', [v('x'), c('a')])],  
     ['y', a('f', [a('h', [v('x')]), v('y'), a('g', [v('x'), c('a')])])]]
);



function unifier(t1,t2){
    if(is_v(t1)){
        if(tid(t1) == tid(t2))
            return [];
        if(member(teq, t1, termVars(t2)))
            return false;
        return [[tid(t1), t2]];
    }
    if(is_v(t2)) return unifier(t2, t1);
    if(is_c(t1) || is_c(t2))
        return teq(t1,t2) ? [] : false;
        if(tid(t1) == tid(t2))
            return unifyList(params(t1), params(t2), []);
    return false;
            
}

function unifyList(t1s, t2s, subst){
    // if t1s not empty, 
    // s = unifier(head(t1s), head(t2s))
    //   if s == false ? ==> false
    //   else if head(s) not member of subst, subst = subst + s
    //      unifyLists(rest(t1s),rest(t2s))
    // else if subst[head(s)] != snd(s) ==> fail/false
    if(t1s.length <= 0) return subst;
    else {
        var subst1 = unifier(fst(t1s), fst(t2s));
        if(subst1){
            var sub_t1s = rest(t1s).map(function(t){ return substitute(t, subst1)});
            var sub_t2s = rest(t2s).map(function(t){ return substitute(t, subst1)});
            return unifyList(sub_t1s, sub_t2s, compSubst(subst,subst1));
        }
        return false;
    }    
}

// returns false if it fails, or the substitution otherwise
function unify(t1,t2){
    return unifier(t1,t2);
}



// console.log(unify(a('f',[c('a'),c('a')]), a('f',[v('X'),c('a')])));
// console.log(unify(a('cons',[v('X'),v('L')]), a('cons',[c('zero'),c('nil')])));
// console.log(util.inspect(unify(v('Y'), a('cons',[
//      a('succ', [c('zero')]),  // 1
//      a('cons', [
//          a('succ',[a('succ',[c('zero')])]), // 2
//          c('nil') 
//      ])
//  ])), { depth: null }));
// console.log(util.inspect(unify(a('cons',[v('X'),v('Z')]), v('U')), { depth: null }));

// console.log(util.inspect(
// unify(
//     a('eq', [a('cons',[v('X'),v('L')]), v('Y'), a('cons', [v('X'),v('Z')])]),
//     a('eq', [a('cons',[c('zero'),c('nil')]), a('cons',[
//         a('succ', [c('zero')]),  // 1
//         a('cons', [
//             a('succ',[a('succ',[c('zero')])]), // 2
//             c('nil') 
//         ])
//     ]), v('U')]) 
// ),  { depth: null }));



// a rule is a list of terms. 
// first term is the head (or conclusion)
// the rest is the body (or hypotheses)

function head(r){
    return r[0];
}
function body(r){
    return r.slice(1);
}

// a goal is a term

// select the rules whose head match id
function chooseRules(rules, id){
    return rules.filter(function(r){ return id == tid(head(r)); });
}


function some(f, lst){
    if(lst.length == 0)
        return false
    else {
        //console.log("some", lst)
        return f(fst(lst)) || some(f, rest(lst));
    }
}



var freshnessCounter = 0;
function fresh(){
    return '_var' + freshnessCounter++;
}

function renameRule_(rule){ // a rule is a list of terms
    return rule.map(
        function(t){
            return renameTerm_(t);
        }
    );
}

function rename(rule){
    // rename '_'
    var rule2 = renameRule_(rule);
    // set of variables in rule
    var ruleVars = rule2
        .map(function(t){ return termVars(t)})
        .reduce(function(l1, l2){ return union(l1,l2); });
    
    // new substitution to rename the vars
    var subst = ruleVars.map(function(t){ return [tid(t), v(fresh())]; });
    //console.log(subst);
    // apply substitution
    var renamedRule = rule2.map(function(t){ 
        var t2 =  substitute(t, subst); 
        return t2;
    })
    return renamedRule;
}


// solver
function solve(goal, rules, disp, next) {
    var goalVars = termVars(goal); // list of {type:var,...} in goal

    //console.log(goalVars);
    function otherSol(vars, vals){
        if(vars.length == 0)
            return true;
        if(vals.length > 0){
            var s = [];
            for(var i=0;i<vars.length; i++){
                //console.log(pprint(vars[i]) + " = " + pprint(vals[i]));
                if(!tid(vars[i]).startsWith('_')) // we don't care about '_' vars
                    s.push(pprint(vars[i]) + " = " + pprint(vals[i]));
            }
            if(disp) disp(s);
            return next && next() ? false : true;
        }
        return false;
    }

    function solveGoals(goals, vals){
      if(goals.length == 0){
         return otherSol(goalVars, vals);
      }
      
      var goal1 = fst(goals);
      var chosenRules = chooseRules(rules, tid(goal1));
      var sol = some(
          function(r1){
              var r2 = rename(r1);
              var h = head(r2);
              var subst1 = unifier(goal1, h);

              if(subst1){
                  var newGoals = body(r2).concat(rest(goals)).map(function(t){
                      return substitute(t, subst1);
                  });
                  var newVals = vals.map(function(t){
                      return substitute(t, subst1);
                  });
                  return solveGoals(newGoals, newVals);
              }
              return false;
          }, 
          chosenRules);
      return sol;
  }

  var s = solveGoals([renameTerm_(goal)], goalVars);
  return s;

}


// examples

var greekGods = [
    [a('grandparent-of',[v('X'), v('Y')]),
         a('parent-of',[v('X'), v('Z')]),
         a('parent-of',[v('Z'), v('Y')])],
    [a('parent-of',[v('X'), v('Y')]),
         a('father-of',[v('X'), v('Y')])],
    [a('parent-of',[v('X'), v('Y')]),
         a('mother-of',[v('X'), v('Y')])],
    [a('brother-of',[v('Y'),v('Z')]),
     a('parent-of',[v('X'), v('Y')]),
     a('parent-of',[v('X'), v('Z')])],
    [a('father-of',[c('ouranos'),c('cronos')])],
    [a('father-of',[c('cronos'),c('zeus')])],
    [a('father-of',[c('zeus'),c('helene')])],
    [a('father-of',[c('zeus'),c('pollux')])],
    [a('father-of',[c('zeus'),c('castor')])],
    [a('mother-of',[c('gaia'),c('cronos')])],
    [a('mother-of',[c('rhea'),c('zeus')])],
    [a('mother-of',[c('rhea'),c('hades')])]
];

// console.log(solve(a('grandparent-of',[c('cronos'),v('Z')]), greekGods));
//console.log(solve(a('grandparent-of',[v('Y'),v('Z')]), greekGods));


/*
var appendProg = [
    [a('append',[c('nil'),v('X'),v('X')])],

    [a('append',[a('cons', [v('H'),v('X')]), 
                 v('Y'), 
                 a('cons', [v('H'),v('Z')])]),
       a('append',[v('X'), v('Y'), v('Z')])]
];

// append([1,2], [3,4], Z) ?
console.log(solve(a('append',[
    a('cons',[c('1'), a('cons',[c('2'), c('nil')])]),
    a('cons',[c('3'), a('cons',[c('4'), c('nil')])]),
    v('Z')
]), appendProg));
*/



// append(nil,L,L).
// append(cons(H,L1),L2,cons(H,L3)) :- append(L1,L2,L3).

var parsedAppendProg = 
{
   "clauses": [
      [
         {
            "type": "atom",
            "id": "append",
            "params": [
               {
                  "type": "const",
                  "id": "nil"
               },
               {
                  "type": "var",
                  "id": "L"
               },
               {
                  "type": "var",
                  "id": "L"
               }
            ]
         }
      ],
      [
         {
            "type": "atom",
            "id": "append",
            "params": [
               {
                  "type": "atom",
                  "id": "cons",
                  "params": [
                     {
                        "type": "var",
                        "id": "H"
                     },
                     {
                        "type": "var",
                        "id": "L1"
                     }
                  ]
               },
               {
                  "type": "var",
                  "id": "L2"
               },
               {
                  "type": "atom",
                  "id": "cons",
                  "params": [
                     {
                        "type": "var",
                        "id": "H"
                     },
                     {
                        "type": "var",
                        "id": "L3"
                     }
                  ]
               }
            ]
         },
         {
            "type": "atom",
            "id": "append",
            "params": [
               {
                  "type": "var",
                  "id": "L1"
               },
               {
                  "type": "var",
                  "id": "L2"
               },
               {
                  "type": "var",
                  "id": "L3"
               }
            ]
         }
      ]
   ]
}

// console.log(solve(a('append',[
//     a('cons',[c('1'), a('cons',[c('2'), c('nil')])]),
//     a('cons',[c('3'), a('cons',[c('4'), c('nil')])]),
//     v('Z')
// ]), parsedAppendProg.clauses));
