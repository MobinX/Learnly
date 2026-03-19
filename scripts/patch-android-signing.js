const fs = require('fs');
const path = require('path');

const buildGradlePath = path.join('android', 'app', 'build.gradle');
const gradlePropertiesPath = path.join('android', 'gradle.properties');

console.log('Patching Android signing configuration...');

// 1. Patch android/app/build.gradle
let buildGradle = fs.readFileSync(buildGradlePath, 'utf8');

// Define the release signing config
const releaseSigningConfig = `
        release {
            if (project.hasProperty('MYAPP_UPLOAD_STORE_FILE')) {
                storeFile file(MYAPP_UPLOAD_STORE_FILE)
                storePassword MYAPP_UPLOAD_STORE_PASSWORD
                keyAlias MYAPP_UPLOAD_KEY_ALIAS
                keyPassword MYAPP_UPLOAD_KEY_PASSWORD
            }
        }`;

// Insert release signing config if not present
if (!buildGradle.includes("signingConfigs {") || buildGradle.includes("storeFile file(MYAPP_UPLOAD_STORE_FILE)")) {
  console.log('Signing config already present or structure not found, checking next step...');
} else {
  // Simple regex to inject after debug config
  // Looking for the closing brace of debug { ... } inside signingConfigs
  // This is a bit fragile, so we'll look for the end of the debug block.
  // Standard RN template:
  // signingConfigs {
  //    debug {
  //        ...
  //    }
  // }
  
  // We'll replace "signingConfigs {" with "signingConfigs {" + releaseSigningConfig
  // Wait, that puts it before debug. That's fine.
  
  buildGradle = buildGradle.replace('signingConfigs {', `signingConfigs {${releaseSigningConfig}`);
  console.log('Injected release signing config.');
}

// Update release build type to use release signing config
// Look for "signingConfig signingConfigs.debug" inside release block?
// Or just globally replace it if it's in release?
// Standard template has "signingConfig signingConfigs.debug" in release block.
// We should replace it carefully.

const releaseBlockRegex = /buildTypes\s*{[\s\S]*?release\s*{[\s\S]*?}/;
const match = buildGradle.match(releaseBlockRegex);

if (match) {
    const releaseBlock = match[0];
    if (releaseBlock.includes('signingConfig signingConfigs.debug')) {
        const newReleaseBlock = releaseBlock.replace('signingConfig signingConfigs.debug', 'signingConfig signingConfigs.release');
        buildGradle = buildGradle.replace(releaseBlock, newReleaseBlock);
        console.log('Updated release build type to use release signing config.');
    } else {
        console.log('Could not find signingConfig signingConfigs.debug in release block, skipping update.');
    }
} else {
    console.log('Could not find release build type block.');
}

fs.writeFileSync(buildGradlePath, buildGradle);


// 2. Patch android/gradle.properties
let gradleProperties = fs.readFileSync(gradlePropertiesPath, 'utf8');

const keystoreProps = `
MYAPP_UPLOAD_STORE_FILE=release.keystore
MYAPP_UPLOAD_KEY_ALIAS=${process.env.ANDROID_KEY_ALIAS}
MYAPP_UPLOAD_STORE_PASSWORD=${process.env.ANDROID_STORE_PASSWORD}
MYAPP_UPLOAD_KEY_PASSWORD=${process.env.ANDROID_KEY_PASSWORD}
`;

fs.appendFileSync(gradlePropertiesPath, keystoreProps);
console.log('Appended signing keys to gradle.properties.');
