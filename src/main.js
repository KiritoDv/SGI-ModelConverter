const fs = require('fs');
const path = require('path');
const { Console } = require('console');

var vtxData = {};

function convertModel(modelPath){

    console.log('Converting Model: '+modelPath);

    var modelInc = fs.readFileSync(modelPath, 'utf-8').split('\n');
    
    var vtxPrefix = "static const Vtx";
    var vtxName = undefined;
    var isReadingVtx = false;

    var gfxData = {};
    var gfxPrefix = "static const Gtx";
    var gfxName = undefined;
    var isReadingGfx = false;

    modelInc.forEach(unformatLine => {
        var line = unformatLine.trim();

        if(line.startsWith(vtxPrefix)){
            vtxName = line.replace(vtxPrefix, '').replace('[] = {', '').trim();        
            vtxData[vtxName] = {
                'vertexData': [],
                'vertexIndex': []
            };
            isReadingVtx = true;
        }

        if(isReadingVtx){
            if(line.startsWith('{{{')){
                //        0        1         2       3        4        5         6         7          8        9
                // '[ -3532', ' -1842', ' -6069]', '0', '[     0', '     0]', '[0x00',   '0x00', '0x00',    '0xff]'
                var unformattedVtx = line.substring(1, line.length - 2).replace(/[{]+/g, '[').replace(/[}]+/g, ']').split(/[,]+/g);
                
                var pos = [
                    parseFloat(unformattedVtx[0].replace('[', '').trim()),
                    parseFloat(unformattedVtx[1].trim()),
                    parseFloat(unformattedVtx[2].replace(']', '').trim())
                ]

                var texPos = [
                    parseFloat(unformattedVtx[4].replace('[', '').trim()),
                    parseFloat(unformattedVtx[5].replace(']', '').trim())
                ]
                
                var color = [
                    parseFloat(unformattedVtx[6].replace('[', '').trim(), 16),
                    parseFloat(unformattedVtx[7].trim(), 16),
                    parseFloat(unformattedVtx[8].trim(), 16),
                    parseFloat(unformattedVtx[9].replace(']', '').trim(), 16)
                ]            

                vtxData[vtxName]['vertexData'].push([pos, texPos, color]);
            }else if(line.startsWith("};")){
                isReadingVtx = false;
                vtxName = undefined;
            }
        }    

        if(line.startsWith('gsSPVertex')){
            var unformattedSPVertex = line.replace('gsSPVertex(', '').replace('),', '').split(/[,]+/g);
            gfxName = unformattedSPVertex[0];
            // var vtxLength = unformattedSPVertex[1];

            console.log(gfxName)

            if(vtxData[gfxName]){            
                isReadingGfx = true;
            }
        }    

        if(isReadingGfx){
            var nextLine = modelInc[modelInc.indexOf(unformatLine) + 1];        

            if(line.startsWith('gsSP2Triangles') || line.startsWith('gsSP1Triangle')){
                var formattedSP = line.replace('gsSP2Triangles', '').replace('gsSP1Triangle', '').replace('(', '').replace('),', '').trim().split(/[,]+/g)
                if(formattedSP.length == 8){
                    vtxData[gfxName]['vertexIndex'].push([parseInt(formattedSP[0].trim()), parseInt(formattedSP[1].trim()), parseInt(formattedSP[2].trim())])
                    vtxData[gfxName]['vertexIndex'].push([parseInt(formattedSP[4].trim()), parseInt(formattedSP[5].trim()), parseInt(formattedSP[6].trim())])
                }else{
                    vtxData[gfxName]['vertexIndex'].push([parseInt(formattedSP[0].trim()), parseInt(formattedSP[1].trim()), parseInt(formattedSP[2].trim())])                
                }
            }
            if(nextLine && (nextLine.trim().startsWith('gsSPVertex') || nextLine.trim().startsWith('gsSPEndDisplayList'))){
                isReadingGfx = false;
            }
        }
    })
}

fs.readdirSync(path.join(__dirname, 'models-a')).sort((a, b) => a - b).forEach(area => {
    const filePath = path.join(__dirname, 'models-a', area, 'model.inc.c');
    if(fs.existsSync(filePath)){
        convertModel(filePath);
    }    
})

var exportType = "obj";
//convertModel(path.join(__dirname, 'models', 'model.inc.c'));

if(Object.keys(vtxData).length > 0){
    var vPointsList = [];
    var vTextureList = [];
    var vPosList = [];
    var lastTIndex = 1;

    Object.keys(vtxData).forEach((vtxKey, seg_index) => {
        var vtx = vtxData[vtxKey];                
        switch(exportType){
            case "obj": {

                vtx['vertexIndex'].forEach((vtxD, index) =>{
                    vPosList.push(`f ${vtxD[0] + lastTIndex}/${vtxD[0] + lastTIndex} ${vtxD[1] + lastTIndex}/${vtxD[1] + lastTIndex} ${vtxD[2] + lastTIndex}/${vtxD[2] + lastTIndex}`);
                })                

                vtx['vertexData'].forEach((vtxD) =>{
                    vPointsList.push(`v ${vtxD[0][0]} ${vtxD[0][1]} ${vtxD[0][2]}`);
                    vTextureList.push(`vt ${vtxD[1][0]} ${vtxD[1][1]} ${vtxD[0][2]}`);
                    lastTIndex++;
                })                            
                
                //vExportLines.push(`var points = [${vPointsList}];`);
                //vExportLines.push(" ");
                //vExportLines.push(`var triangles = [${vPosList}];`);
            }
        }
    })

    switch(exportType){
        case "p5js": {
            fs.writeFile('./converted/models-a.json', JSON.stringify(vtxData), function (err) {
                if (err) return console.log(err);
                console.log('File succefully converted');
            });
            break;
        }
        case "obj": {            
            var vExportLines = [];

            vExportLines.push(`# Exported with SGI-ModelConverter`);
            vExportLines.push("# For private use");
            vExportLines.push("o models-a.obj");
            vExportLines.push(vPointsList.join('\n'));
            vExportLines.push(vTextureList.join('\n'));
            vExportLines.push("s off");
            vExportLines.push(vPosList.join('\n'));
            fs.writeFile('./converted/models-a.obj', vExportLines.join('\n'), function (err) {
                if (err) return console.log(err);
                console.log('File succefully converted');
            });
        }
    }
}