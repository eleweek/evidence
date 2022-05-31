const { readdirSync, readJSONSync, writeJSONSync, pathExistsSync, emptyDirSync, mkdirSync } = require('fs-extra')
const md5 = require("blueimp-md5")
const chalk = require('chalk')
const logEvent = require('@evidence-dev/telemetry')
//const getColumnSummary = require('@evidence-dev/components/modules/getColumnSummary');
const readline = require('readline');

const cacheDirectory = "./.evidence-queries/cache";

var EvidenceType;
(function (EvidenceType) {
    EvidenceType["BOOLEAN"] = "boolean";
    EvidenceType["NUMBER"] = "number";
    EvidenceType["STRING"] = "string";
    EvidenceType["DATE"] = "date";
})(EvidenceType || (EvidenceType = {})); //TODO avoid duplication

var TypeFidelity;
(function (TypeFidelity) {
    TypeFidelity["INFERRED"] = "inferred";
    TypeFidelity["PRECISE"] = "precise";
    TypeFidelity["UNKNOWN"] = "unknown";
})(TypeFidelity || (TypeFidelity = {}));


const getQueryCachePaths = (queryString, queryTime) => {
    let path = `${cacheDirectory}/${md5(queryTime)}`;
    return {
        'cacheDirectory': path,
        'resultsCacheFile': `${cacheDirectory}/${md5(queryTime)}/${md5(queryString)}.json`,
        'columnTypeCacheFile': `${cacheDirectory}/${md5(queryTime)}/${md5(queryString)}-column-types.json`,
    }
}

const updateCache = function (dev, queryString, data, columnTypes, queryTime) {
    if (dev) {
        const {cacheDirectory, resultsCacheFile, columnTypeCacheFile} = getQueryCachePaths(queryString, queryTime);
        if (!pathExistsSync(cacheDirectory)) {
            emptyDirSync(cacheDirectory); //TODO I think this invalidates the entire cache.  Check if this is by design.
            mkdirSync(cacheDirectory, { recursive: true });
        }
        writeJSONSync(resultsCacheFile, data, { throws: false });
        if (columnTypes) {
            writeJSONSync(columnTypeCacheFile, data, { throws: false });
        }
    }
}

const validateQuery = function (query) { 
    if (query.id === 'untitled') {
        throw "Queries require a title"
    }
    if (query.id === 'evidencemeta') {
        throw "Invalid query name: 'evidencemeta'"
    }
    if (query.compiledQueryString.length === 0) {
        throw "Enter a query"
    }
    if (query.compileError) {
        throw query.compileError
    }
}

const importDBAdapter = async function(settings) {
    try {
        databaseType = settings ? settings.database : process.env["DATABASE"] || process.env["database"]
        const { default: runQuery } = await import('@evidence-dev/'+ databaseType);
        return runQuery
    }catch {
        const runQuery = async function(){
            throw 'Missing database credentials'
        }
        return runQuery
    }
}

const inferValueType = function (columnValue) {
    if (typeof columnValue == 'number') {
        return EvidenceType.NUMBER;
    } else if (typeof columnValue == 'boolean') {
        return EvidenceType.BOOLEAN;
    } else {
        //TODO see what Sean did. May make sense to send a bunch of rows
        //may also want to look for numbers and booleans in strings (e.g "232.232", or "false")
        return EvidenceType.STRING;
    }
}
const inferFieldTypes = function (rows) {
    if (rows && rows.length > 0) {
        let columns = Object.keys(rows[0]);
        let fieldTypes = columns?.map(column => {
            let firstRowWithColumnValue = rows.find(element => element[column] == null ? false: true);
            if (firstRowWithColumnValue) {
                let inferredType = inferValueType(firstRowWithColumnValue[column]);
                return {'name':column, 'evidenceType':inferredType, 'typeFidelity':TypeFidelity.INFERRED};
            } else {
                return {'name':column, 'evidenceType':inferredType, 'typeFidelity':TypeFidelity.UNKNOWN};
            }
        });
        return fieldTypes;
    }
    return undefined;
}
const processQueryResults = function (queryResults) {
    let rows;
    let fieldTypes;
    
    console.log(`Post processing query results with fields ${JSON.stringify(queryResults.fieldTypes, null, 2)}`);
    if (queryResults.rows) {
        rows = queryResults.rows;
    } else {
        rows = queryResults;
    }

    if (queryResults.fieldTypes) {
        fieldTypes = queryResults.fieldTypes;
    } else {
        fieldTypes = inferFieldTypes(rows);
    }

    console.log(`Processed query results. Original:${JSON.stringify(queryResults)}\n Rows:${JSON.stringify(rows)}\n FieldTypes:${JSON.stringify(fieldTypes)}`);
    
    return {rows, fieldTypes};
}

const setQueryColumnTypes = (data, queryIndex, columnTypes) => {
    let queryMetaData = data.evidencemeta?.queries[queryIndex];
    if (columnTypes) {
        queryMetaData.fieldTypes = columnTypes;
    } else {
        console.log("Field types not found");
    }
} 

const runQueries = async function (routeHash, dev) {
    const settings = readJSONSync('./evidence.settings.json', {throws:false})
    const runQuery = await importDBAdapter(settings)

    let routePath = `./.evidence-queries/extracted/${routeHash}`
    let queryFile = `${routePath}/${readdirSync(routePath)}`
    let queries = readJSONSync(queryFile, { throws: false }) 

    
    if (queries.length > 0) {
        let data = {}
        data["evidencemeta"] = {queries} // eventually move to seperate metadata API (md frontmatter etc.) 
        for (let queryIndex in queries) {
            let query = queries[queryIndex];
            let queryTime = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), new Date().getHours());              
            let cache, columnTypeCache;
            if (dev) {
                const { resultsCacheFile, columnTypeCacheFile } = getQueryCachePaths(query.compiledQueryString, queryTime);
                cache = readJSONSync(resultsCacheFile, { throws: false });
                columnTypeCache = readJSONSync(columnTypeCacheFile, { throws: false });
            }
            if (cache) {
                logEvent("cache-query", dev);
                data[query.id] = cache;
                if (columnTypeCache) {
                    setQueryColumnTypes(data, queryIndex, columnTypeCache);
                }
                process.stdout.write(chalk.greenBright("✓ "+ query.id) +  chalk.grey(" from cache \n"));
            } else {
                try {
                    process.stdout.write(chalk.grey("  "+ query.id +" running..."));
                    validateQuery(query);
                    let {rows, fieldTypes} = processQueryResults(await runQuery(query.compiledQueryString, settings?.credentials, dev));

                    console.log(`Ran query ${query.id} and obtained rows ${JSON.stringify(rows, null, 2)} and columnTypes=${JSON.stringify(fieldTypes, null, 2)}`);

                    data[query.id] = rows;
                    setQueryColumnTypes(data, queryIndex, fieldTypes);

                    readline.cursorTo(process.stdout, 0);
                    process.stdout.write(chalk.greenBright("✓ "+ query.id) + chalk.grey(" from database \n"))

                    updateCache(dev, query.compiledQueryString, data[query.id], fieldTypes, queryTime);

                    logEvent("db-query", dev, settings)
                } catch(err) {
                    readline.cursorTo(process.stdout, 0);
                    process.stdout.write(chalk.red("✗ "+ query.id) + " " + chalk.grey(err) + " \n")
                    data[query.id] = [ { error_object: {error: { message: err } } } ]
                    logEvent("db-error", dev, settings)
                } 
            }
        }
        return data
    }
}


const testConnection = async function () {
    let query = {
        id: "Connection Test",
        compiledQueryString: "select 100 as num"
    }
    let result;
    const settings = readJSONSync('./evidence.settings.json', {throws:false})

    const { default: runQuery } = await import('@evidence-dev/'+ settings.database);

    try {
        process.stdout.write(chalk.grey("  "+ query.id +" running..."))
        await runQuery(query.compiledQueryString, settings.credentials)
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(chalk.greenBright("✓ "+ query.id) + chalk.grey(" from database \n"))
        result = "Database Connected";
    } catch(err) {
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(chalk.red("✗ "+ query.id) + " " + chalk.grey(err) + " \n")
        result = err;
    } 
    return result
}

module.exports = {
    runQueries,
    testConnection
}
