if (typeof require !== 'undefined') {
    var dissect = require('./dissection/dissection').dissect;
    var switchByteOrder = require('./dissection/byteOrder').switchByteOrder;
}

var getURL, appendPacketData, dataURL;
var MAGIC_NUMBER = (0xa1b2c3d4 >>> 0);
var MIMETYPE = 'application/vnd.tcpdump.pcap';

if (typeof window !== 'undefined') {
    if (Blob && window.URL && URL.createObjectURL) {
        getURL = getBlobURL; 
    }
    else {
        getURL = getDataURL;
        dataURL = 'data:' + MIMETYPE + ';base64,' + 
                base64ArrayBuffer(createPcapGlobalHeader());
    }
}

function createPcapGlobalHeader() {
    // 24 bytes for the global pcap header
    var pcap_global_header = new ArrayBuffer(24);
    
    // we need to fill it with integers and shorts
    var shortView = new Uint16Array(pcap_global_header);
    var intView   = new Uint32Array(pcap_global_header);

    // fill in values for global header
    intView[0]   = MAGIC_NUMBER; // magic number
    shortView[2] = 2;            // version major
    shortView[3] = 4;            // version minor ~> version 2.4
    intView[2]   = 0;            // diff between local time & UTC
    intView[3]   = 0;            // timestamp accuracy
    intView[4]   = 65535;        // snaplen
    // intView[5]   = 1;            // Ethernet    
    intView[5]   = 113;          // linux cooked capture
    
    return pcap_global_header;
}

function getDataURL() {
    return dataURL + base64ArrayBuffer(mergeBuffers(getRawPackets()));
}

function getBlobURL() {
    var content = appendBuffer(createPcapGlobalHeader(), mergeBuffers(getRawPackets()));
    var blob = new Blob([content], {type: MIMETYPE, size: content.byteLength});
    return URL.createObjectURL(blob);
}

function readPcapFile(file, f) {
    var fr = new FileReader();
    fr.readAsArrayBuffer(file);
    fr.onload = function() {dissectPcapFile(fr.result, f);}; 
}

function dissectPcapFile(data, f) {
    var magic_number = new Uint32Array(data, 0, 1)[0] >>> 0;
    if (magic_number === ntohl(MAGIC_NUMBER))
        switchByteOrder(false);
    else if (magic_number !== MAGIC_NUMBER) {
        // alert('Invalid Magic Number'); // FIXME
        return false;
    }
    dissect(data.slice(24), f);
    switchByteOrder(true); // always reset this value
    return true;
}

if (typeof module !== 'undefined') {
    module.exports.readPcapFile = readPcapFile;
    module.exports.dissectPcapFile = dissectPcapFile;
}