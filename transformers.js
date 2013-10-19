/**
  ## Custom Transformers

  Listed below are a number of transforms that require special treatment to
  do their thing (i.e. more than `b.transform(module)`).

**/

/**
  ### es6ify

  As per the instructions at: https://github.com/thlorenz/es6ify
**/
exports.es6ify = function(b, t, target) {
  console.log(t);

  // add the runtime, and then transform
  b.add(t.runtime).transform(t);
};