import fs from 'fs';

const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const version = packageJson.version;
const [major, minor, patchWord] = version.split('.');
let newPatch;
if (patchWord.includes('-')) {
    // Handle pre-release versions by extracting the numeric part
    newPatch = parseInt(patchWord.split('-')[0], 10);
    newPatch += 1;
    // Reconstruct the pre-release version
    newPatch = `${newPatch}-${patchWord.split('-')[1]}`;
}
else{
    newPatch = parseInt(patchWord, 10) + 1;
}

// Increment patch version
packageJson.version = `${major}.${minor}.${newPatch}`;

// Write back to package.json with proper formatting
fs.writeFileSync('./package.json', JSON.stringify(packageJson, null, 2) + '\n');

console.log(`Version bumped from ${version} to ${packageJson.version}`);