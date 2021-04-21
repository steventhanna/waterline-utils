/**
 * Module dependencies
 */

var _ = require('@sailshq/lodash');
var async = require('async');
var informReFailedAlterStratagem = require('./private/inform-re-failed-alter-stratagem');

/**
 * runCreateStrategy()
 *
 * Build each table with the new model definition, without modifying any
 * existing data in the table.
 *
 * @param  {[type]}   orm [description]
 * @param  {Function} cb  [description]
 * @return {[type]}       [description]
 */
module.exports = function runCreateStrategy(orm, cb) {
  // Refuse to run this migration strategy in production.
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_UNSAFE_MIGRATIONS) {
    return cb(new Error('`migrate: \'create\'` strategy is not supported in production, please change to `migrate: \'safe\'`.'));
  }

  // The create strategy works by looping through each collection in the ORM and
  // rebuilds it based on the collection's schema definition and the `autoMigrations`
  // settings on the attributes.
  async.each(_.keys(orm.collections), function simultaneouslyMigrateEachModel(modelIdentity, next) {
    var WLModel = orm.collections[modelIdentity];

    // Grab the adapter to perform the query on
    var datastoreName = WLModel.datastore;
    var WLAdapter = orm.datastores[datastoreName].adapter;

    // Set a tableName to use
    var tableName = WLModel.tableName;

    // Build a dictionary to represent the underlying physical database structure.
    var tableDDLSpec = {};
    try {
      _.each(WLModel.schema, function parseAttribute(wlsAttrDef, wlsAttrName) {
        // If this is a plural association, then skip it.
        // (it is impossible for a key from this error to match up with one of these-- they don't even have column names)
        if (wlsAttrDef.collection) {
          return;
        }

        var columnName = wlsAttrDef.columnName;

        // If the attribute doesn't have an `autoMigrations` key on it, throw an error.
        if (!_.has(wlsAttrDef, 'autoMigrations')) {
          throw new Error('An attribute in the model definition: `' + wlsAttrName + '` is missing an `autoMigrations` property. When running the `alter` migration, each attribute must have an autoMigrations key so that you don\'t end up with an invalid data schema.');
        }

        tableDDLSpec[columnName] = wlsAttrDef.autoMigrations;
      });
    } catch (e) {
      return next(e);
    }

    // Set Primary Key flag on the primary key attribute
    var primaryKeyAttrName = WLModel.primaryKey;
    var primaryKey = WLModel.schema[primaryKeyAttrName];
    if (primaryKey) {
      var pkColumnName = primaryKey.columnName;
      tableDDLSpec[pkColumnName].primaryKey = true;
    }

    //  ╔╦╗╔═╗╔═╗╦╔╗╔╔═╗  ┌┬┐┌─┐┌┐ ┬  ┌─┐
    //   ║║║╣ ╠╣ ║║║║║╣    │ ├─┤├┴┐│  ├┤
    //  ═╩╝╚═╝╚  ╩╝╚╝╚═╝   ┴ ┴ ┴└─┘┴─┘└─┘
    WLAdapter.define(datastoreName, tableName, tableDDLSpec, function defineCallback(err) {
      if (err) {
        informReFailedAlterStratagem(err, 'define', WLModel.identity, next);//_∏_
        return;
      }//-•
      return next();
    });//</ define >

  }, function afterMigrate(err) {
    if (err) {
      return cb(err);
    }

    return cb();
  });
};
