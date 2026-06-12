const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../node_modules/react-native-track-player/android/src/main/java/com/doublesymmetry/trackplayer/module/MusicModule.kt');

if (!fs.existsSync(filePath)) {
    console.log('MusicModule.kt not found, skipping patch.');
    process.exit(0);
}

let content = fs.readFileSync(filePath, 'utf8');

// 1. Nullability fixes
content = content.replace(
    "callback.resolve(Arguments.fromBundle(musicService.tracks[index].originalItem))",
    "callback.resolve(Arguments.fromBundle(musicService.tracks[index].originalItem ?: Bundle()))"
);
content = content.replace(
    "musicService.tracks[musicService.getCurrentTrackIndex()].originalItem",
    "musicService.tracks[musicService.getCurrentTrackIndex()].originalItem ?: Bundle()"
);

// 2. scope.launch return type fixes
const regex = /fun\s+(\w+)\(([^)]*)\)\s*=\s*scope\.launch\s*\{/gs;
let match;

while ((match = regex.exec(content)) !== null) {
    const startIdx = match.index;
    const launchBraceIdx = startIdx + match[0].length - 1; // '{' of 'scope.launch {'
    
    let depth = 1;
    let ptr = launchBraceIdx + 1;
    while (ptr < content.length && depth > 0) {
        if (content[ptr] === '{') depth++;
        else if (content[ptr] === '}') depth--;
        ptr++;
    }
    
    if (depth === 0) {
        const endBraceIdx = ptr - 1;
        
        const funDecl = `fun ${match[1]}(${match[2]}) { scope.launch {`;
        const bodyContent = content.substring(launchBraceIdx + 1, endBraceIdx);
        const newSegment = funDecl + bodyContent + "}}";
        
        content = content.substring(0, startIdx) + newSegment + content.substring(endBraceIdx + 1);
        
        // Reset regex index to scan correctly after modification
        regex.lastIndex = startIdx + newSegment.length;
    } else {
        regex.lastIndex = startIdx + match[0].length;
    }
}

const musicServicePath = path.join(__dirname, '../node_modules/react-native-track-player/android/src/main/java/com/doublesymmetry/trackplayer/service/MusicService.kt');
if (fs.existsSync(musicServicePath)) {
    let serviceContent = fs.readFileSync(musicServicePath, 'utf8');
    serviceContent = serviceContent.replace(
        "interceptPlayerActionsTriggeredExternally = true,",
        "interceptPlayerActionsTriggeredExternally = false,"
    );
    fs.writeFileSync(musicServicePath, serviceContent, 'utf8');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('react-native-track-player patched successfully for Kotlin 2.x, React Native 0.81, and Android 14 MediaSession stability!');
