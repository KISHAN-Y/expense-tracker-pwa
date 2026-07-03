const sharp = require('sharp');
const fs = require('fs');

async function convert() {
    try {
        await sharp('assets/Spendlyst.svg')
            .resize(192, 192)
            .png()
            .toFile('assets/icon-192.png');
        console.log('Created icon-192.png');

        await sharp('assets/Spendlyst.svg')
            .resize(512, 512)
            .png()
            .toFile('assets/icon-512.png');
        console.log('Created icon-512.png');
    } catch (error) {
        console.error('Error:', error);
    }
}

convert();
