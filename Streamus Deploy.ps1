#  TODO: Prompt for version number.
#  TODO: Minify CSS and JavaScript for obfuscation purposes. (maybe just JavaScript)
$version = '0.65';
$rootPath = ${env:userprofile} + '\Documents\GitHub\Streamus'

$deploymentPath = $rootPath + '\Deploy';

#  Create a deployment directory if it does not already exist. This will be the staging area for deploying the client/server.
if( !(Test-Path $deploymentPath) )
{
    New-Item -ItemType directory -Path $deploymentPath
}
else {
    #  Clear out the deployment folder if it already exists.
    Get-ChildItem $deploymentPath | Remove-Item -Recurse
}

#  Copy the Streams Chrome Extension folder's contents to deployment.
$extensionPath = $rootPath + '\Streamus Chrome Extension';
$excludedDeployEntities = @('*.csproj', '*.csproj.user', 'bin', 'obj', 'Properties');

Get-ChildItem $extensionPath -Exclude $excludedDeployEntities | Copy-Item -destination $deploymentPath -Recurse

$deployedManifestFile = $deploymentPath + '\manifest.json';

$versionManifestEntry =  '"version": "' + $version + '"';

(Get-Content $deployedManifestFile) | 

    #  Find the line that looks like: "version: #.##" and update it with current version
    Foreach-Object {$_ -replace '"version": "[0-9]\.[0-9][0-9]"', $versionManifestEntry} | 

    #  Remove permissions that're only needed for debugging.
    Where-Object {$_ -notmatch '"key": "'} |

    #  Remove manifest key -- can't upload to Chrome Web Store if this entry exists in manifest.json, but helps with debugging.
    Where-Object {$_ -notmatch '"http://localhost:61975/Streamus/",'} |
    
Set-Content -Encoding UTF8 $deployedManifestFile

#  Ensure that isLocal is set to false in programState.js -- local debugging is for development only.
$deployedProgramStateFile = $deploymentPath + '\js\programState.js';

(Get-Content $deployedProgramStateFile) | 
    #  Find the line that looks like: "isLocal: true" and set it to false. Local debugging is for development only.
    Foreach-Object {$_ -replace "isLocal: true", "isLocal: false"} | 
Set-Content $deployedProgramStateFile


#  7-Zip must be installed on the target system for this to work.
#  Inspiration from: http://stackoverflow.com/questions/1153126/how-to-create-a-zip-archive-with-powershell
function create-7zip([String] $aDirectory, [String] $aZipfile){
    [string]$pathToZipExe = "C:\Program Files\7-zip\7z.exe";
    [Array]$arguments = "a", "-tzip", "$aZipfile", "$aDirectory", "-r";
    & $pathToZipExe $arguments;
}

#  Zip up package ready for deployment.
$deployZipPath = $rootPath + '\Streamus v' + $version + '.zip';

create-7zip $deploymentPath $deployZipPath