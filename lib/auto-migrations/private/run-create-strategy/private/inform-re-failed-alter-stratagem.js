/**
 * Module dependencies
 */

var util = require('util');
var _ = require('@sailshq/lodash');

/**
 * informReFailedAlterStratagem()
 *
 * Write a log message to stderr about what went wrong with this auto-migration attempt,
 * then write a temporary log file with the backup records
 *
 * @param  {Error} err
 * @param  {String} operationName
 *     • 'drop'
 *     • 'define'
 *     • 'createEach'
 * @param  {String}   modelIdentity
 * @param  {Function}   done
 *         @param {Error?} err
 *                @property {String?} code  (E_FAILED_ALTER_STRATEGY)
 */
module.exports = function informReFailedAlterStratagem(err, operationName, modelIdentity, done) {

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // FUTURE: Expect app path (e.g. `sails.config.appPath`) as another required argument to
  // ensure that this always writes log output in the proper place; rather than relying on
  // the current working directory, which won't necessarily be right.  (This isn't a show-stopper
  // or anything, but it could be important for certain kinds of hooks that want to get down and
  // dirty with the models and stuff.)
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -


  // Build an error message that we'll log to the console in just a moment.
  var message = '\n'+
  'When attempting to perform the `alter` auto-migration strategy '+
  'on model `' + modelIdentity + '`, Sails encountered ';

  // Negotiate error in order to use an appropriate error message.
  var isUniquenessViolation = (
    operationName === 'createEach' &&
    (err.name === 'AdapterError' && err.code === 'E_UNIQUE')
  );
  var isCoercionFailure = (
    operationName === 'createEach' &&
    (err.name === 'UsageError' && err.code === 'E_INVALID_NEW_RECORDS')
  );

  if (isCoercionFailure) {
    message += 'incompatible data.  '+
    'Some existing `' + modelIdentity + '` record(s) couldn\'t be adjusted automatically to match '+
    'your model definition.  Usually, this is a result of recent edits to your model files; or (less often) '+
    'due to incomplete inserts or modifications made directly to the database by hand.\n'+
    '\n'+
    'Details:\n'+
    '```\n'+
    'Failed to reinsert migrated data. '+(err.details||err.message)+'\n'+
    '```\n';
  }
  else if (isUniquenessViolation) {
    message += 'a conflict.  '+
    'Some existing `' + modelIdentity + '` record(s) violated a uniqueness constraint when attempting to '+
    'recreate them in the database (i.e. there were duplicates).  This is usually the result of recent edits '+
    'to your model files.  For example, someone might have changed a non-unique attribute to be `unique: true`, '+
    'modified a unique attribute\'s `columnName`, or changed the primary key attribute, etc.  Otherwise (more rarely), '+
    'this could be due to additional physical-layer indexes or constraints that were added directly to the '+
    'database by hand.\n'+
    '\n'+
    'Details:\n'+
    '```\n'+
    util.inspect(err)+'\n'+
    '```\n';
  }
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // FUTURE: More error negotiation could be done here to further improve this message.
  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // Otherwise this was some kind of weird, unexpected error.  So we use the catch-all approach:
  else {

    // Convert this error into a string we can safely log (since we have no idea what it
    // is or what it might mean, we can't really make any assumptions.)
    //
    // > Note that, while `err` should always be an Error instance already,
    // > we double check just in case it's not.
    var formattedDisplayError;
    if (_.isError(err) && _.keys(err).length === 0) { formattedDisplayError = err.stack; }
    else if (_.isError(err)) { formattedDisplayError = util.inspect(err); }
    else if (_.isString(err)) { formattedDisplayError = err; }
    else { formattedDisplayError = util.inspect(err, { depth: 5 }); }

    message += 'an unexpected error when performing the `'+operationName+'` step.  '+
    'This could have happened for a number of different reasons: be it because your database went offline, '+
    'because of a db permission issue, because of some database-specific edge case, or (more rarely) it '+
    'could even be due to some kind of bug in this adapter.\n'+
    '\n'+
    'Error details:\n'+
    '```\n'+
    formattedDisplayError+'\n'+
    '```\n';
  }


  // And last but not least, it's time for the suffix.
  message +=
  '\n'+
  '-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- \n'+
  'Any existing `'+ modelIdentity + '` records were deleted, but your data from OTHER models '+
  '(including any relationships tracked in foreign keys and join tables) might still be intact.  '+
  'If you care about recovering any of that data, be sure to back it up now before you continue.\n'+
  // '(In the future, if you want to keep development data in order to practice manual migrations, '+
  // 'then set `migrate: \'safe\'` in config/models.js.)\n'+
  '\n'+
  'The best way to proceed from here is to clear out all of your old development data '+
  'and start fresh; allowing Sails to generate new tables/collections(s) to reflect your '+
  'app\'s models.  (In other words, to DELETE ALL EXISTING DATA stored in models.)\n'+
  '\n'+
  'To do that, re-lift your app using the `drop` strategy:\n'+
  '```\n'+
  'sails lift --drop\n'+
  '```\n'+
  '\n'+
  'After doing that once, you should be able to go about your business as usual.\n'+
  '-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- \n'+
  '\n'+
  'For more about auto-migrations, visit:\n'+
  'https://sailsjs.com/docs/concepts/models-and-orm/model-settings#?migrate\n'+
  '\n';

  // Now that we've fed our error message to make it big and strong, we can log the
  // completed error message to stderr so that the user understands what's up.
  console.error(message);

  return done();

};
