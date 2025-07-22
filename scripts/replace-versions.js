var fs = require('node:fs')
var path = require('node:path')
var exit = require('node:process').exit

var packageName = process.argv[2]
var isRollback = process.argv[3] === '--rollback'
var package = require(`../plugins/${packageName}/package.json`)
var commonPackage = require('../plugins/backstage-plugin-common/package.json')

console.log(
  '\x1b[41mOh boy! Changeset still does not support yarn publish, so we have to manually replace versions in the package.json file ourselves.\x1b[0m',
)

if (isRollback) {
  console.log(`Reverting '@pagerduty/backstage-plugin-common' version in ${package.name}...`)

  var version = package.dependencies['@pagerduty/backstage-plugin-common']

  var matches = /^(\^|\~|)\d*\.\d*\.\d*$/.exec(version)

  if (matches === null) {
    console.error(`\x1b[35mError: Expected '@pagerduty/backstage-plugin-common' to be a version, but got '${version}'\x1b[0m`)
    exit(1)
  }

  var sigil = matches[1] || '*'
    
  console.log(`Replacing ${version} with workspace:${sigil}`)

  package.dependencies['@pagerduty/backstage-plugin-common'] = `workspace:${sigil}`

  rewritePackageJson(packageName, package)
} else {
  console.log(`Replacing '@pagerduty/backstage-plugin-common' version in ${package.name}...`)

  var workspaceProtocol = package.dependencies['@pagerduty/backstage-plugin-common']

  var matches = /^workspace:(\^|\~|)$/.exec(workspaceProtocol)

  if (matches === null) {
    matches = /^(\^|\~|)\d*\.\d*\.\d*$/.exec(workspaceProtocol)

    if (matches !== null) {
      console.warn(`Expected '@pagerduty/backstage-plugin-common' already has a version. No need to replace it.`)
      exit(0)
    }

    console.error(`\x1b[35mError: Expected '@pagerduty/backstage-plugin-common' to be a workspace protocol, but got '${workspaceProtocol}'\x1b[0m`)
    exit(1)
  }

  var sigil = matches[1] === '*' ? '' : matches[1]

  var commonVersion = `${sigil}${commonPackage.version}`

  console.log(`Replacing ${workspaceProtocol} with ${commonVersion}`)

  package.dependencies['@pagerduty/backstage-plugin-common'] = commonVersion
  
  rewritePackageJson(packageName, package)
}

function rewritePackageJson(packageName, packageSpec) {
  fs.writeFileSync(
    path.join(__dirname, `../plugins/${packageName}/package.json`),
    JSON.stringify(packageSpec, null, 2)
  )
}
