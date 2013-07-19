if (typeof require !== 'undefined') {
    var Pcaph = require('./Pcaph');
    var Ethh = require('./Ethh').Ethh;
    var SLLh = require('./SLLh').SLLh;
    var printMAC = require('./Ethh').printMAC;
    var printIPv4 = require('./IPv4h').printIPv4;
    var printIPv6 = require('./IPv6h').printIPv6;
    var IPv4h = require('./IPv4h').IPv4h;
    var IPv6h = require('./IPv6h').IPv6h;
    var ARPh = require('./ARPh');
    var TCPh = require('./TCPh');
    var UDPh = require('./UDPh');
    var appendBuffer = require('./../arrayBuffers').appendBuffer;
}

var oldPacket = null; // cache for previously received data
var dissectedPackets = [];
var rawPackets = [];
// the following two variables will hold the same objects, but...
var connectionsById = {};      // .. these will be accessible via their ID
var connectionsByArrival = []; // .. these are stored chronologically

var counter = 1;

function dissect(data, f) {        
    if (oldPacket !== null) { // consider previously received data
        data = appendBuffer(oldPacket, data);
        oldPacket = null;
    }
    
    if (data.byteLength < 16) { // i.e. not enough for pcap header
        oldPacket = data;
        return null;
    }
    
    var packet = new Pcaph(data, 0);
    
    if (data.byteLength < (packet.incl_len + 16)) { // i.e. packet not complete
        oldPacket = data; // store for next call to dissect
        return null;
    }   
    
    packet.num = counter;
    packet.next_header =
    dissectLinkLayer(packet, data, Pcaph.HLEN); // dissect further  
    
    if(f) f(packet); // callback
    
    // store dissected and raw packet
    dissectedPackets[counter - 1] = packet;
    rawPackets[counter - 1] = data.slice(0, packet.incl_len + 16);
    counter++;  
    
    // see if there is more data to dissect
    if (packet.incl_len > 0 && data.byteLength > (packet.incl_len + 16))
        dissect(data.slice(packet.incl_len + 16), f);
}

var byteView;
var intView;
var shortView;
var infos = [];

// FIXME: performance test
function simpleDissect(data, f) {        
    if (oldPacket !== null) { // consider previously received data
        data = appendBuffer(oldPacket, data);
        oldPacket = null;
    }
    
    if (data.byteLength < 16) { // i.e. not enough for pcap header
        oldPacket = data;
        return null;
    }
        
    intView = new Uint32Array(data, 0, 4);
    byteView = new Uint8Array(data, 0);
    
    if (data.byteLength < (intView[2] + 16)) { // i.e. packet not complete
        oldPacket = data; // store for next call to dissect
        return null;
    }   
    
    infos[0] = counter;
    infos[1] = ' ';
    infos[2] = ' ';
    infos[3] = "LCC";
    infos[4] = intView[2];
    infos[5] = ' ';
    var offset = 16;
    
    // link layer      
    shortView = new Uint16Array(data, offset, 8);
    
    infos[1] = printMAC(byteView.subarray(offset + 6, offset + 6 + ntohs(shortView[2])));
        
    offset += 16;
    
    // network layer
    switch(ntohs(shortView[7])) {
    case 0x0800: // IPv4
        infos[1]  = printIPv4(byteView.subarray(offset + 12, offset + 16));
        infos[2]  = printIPv4(byteView.subarray(offset + 16, offset + 20));
        infos[3] = "IPv4";
        
        var prot = byteView[offset + 9];
        
        offset += (4 * (byteView[offset] & 0x0F));
        
        switch(prot) {
        case 6: 
            shortView = new Uint16Array(data, offset, 10);
            infos[3] = "TCP";
    
            infos[5] = "SPORT: " + ntohs(shortView[0]) + " DPORT: " + ntohs(shortView[1]);
            break;
        }
        break;
    }
    
    if(f) f(infos); // callback
    
    // store raw packet
    rawPackets[counter - 1] = data.slice(0, intView[2] + 16);
    counter++;  
    
    // see if there is more data to dissect
    if (intView[2] > 0 && data.byteLength > (intView[2] + 16))
        simpleDissect(data.slice(intView[2] + 16), f);
}

function dissectLinkLayer(packet, data, offset) {
    // FIXME probably should be variable
    var toReturn = new SLLh(data, offset);       
    packet.src  = printMAC(toReturn.src);
    // packet.dst  = printMAC(toReturn.dst);
    packet.prot = 'Ethernet';
    toReturn.next_header = 
    dissectNetworkLayer(packet, data, offset + toReturn.getHeaderLength(), toReturn);    
    return toReturn;
}

function dissectNetworkLayer(packet, data, offset, parent) {
    var toReturn;
    switch(parent.prot) {
    case 0x0800: // IPv4
        toReturn = new IPv4h(data, offset);
        packet.src  = printIPv4(toReturn.src);
        packet.dst  = printIPv4(toReturn.dst);
        packet.prot = 'IPv4';
        toReturn.next_header = 
        dissectTransportLayer(packet, data, offset + toReturn.getHeaderLength(), toReturn);
        break;
    case 0x86DD: // IPv6
        toReturn = new IPv6h(data, offset);   
        packet.src  = printIPv6(toReturn.src);
        packet.dst  = printIPv6(toReturn.dst);
        packet.prot = 'IPv6';        
        toReturn.next_header = 
        dissectTransportLayer(packet, data, offset + toReturn.getHeaderLength(), toReturn);
        break;
    case 0x0806: // ARP    
        toReturn = new ARPh(data, offset);
        packet.prot = 'ARP';
        break;
    case 0x8035: // RARP
        toReturn = null;
        packet.prot = 'RARP';
        break;
    default: // 'unknown' ethtype
        toReturn = null;
        break;
    }
    return toReturn;
}

function dissectTransportLayer(packet, data, offset, parent) {
    var toReturn;
    switch(parent.prot) {
    case 1: // ICMP
        toReturn = null;      
        packet.prot = 'ICMP';
        break;
    case 6: // TCP
        toReturn = new TCPh(data, offset, parent);
        handleConnection(toReturn, packet, parent);
        packet.prot = 'TCP';
        toReturn.next_header = 
        dissectApplicationLayer(packet, data, offset + toReturn.getHeaderLength(), toReturn);
        break;
    case 17: // UDP
        toReturn = new UDPh(data, offset, parent);
        handleConnection(toReturn, packet, parent);
        packet.prot = 'UDP';
        toReturn.next_header = 
        dissectApplicationLayer(packet, data, offset + toReturn.getHeaderLength(), toReturn);
        break;
    default:
        toReturn = null;
        break;
    }  
    return toReturn;
}

function handleConnection(toReturn, packet, parent) {
    if (!toReturn.id)
        return;
        
    packet.id = toReturn.id;
            
    if (!connectionsById[toReturn.id]) {
        var connection = new Object();
        connection.packets = [packet];        
        connection.src = printIPv4(parent.src);
        connection.dst = printIPv4(parent.dst);
        connection.sport = toReturn.sport;
        connection.dport = toReturn.dport;
        connection.num = 1;
        connection.len = packet.orig_len;
        connection.visible = 0;
        connection.id = toReturn.id;
        
        connectionsById[toReturn.id] = connection;
        connectionsByArrival.push(connection);
    }
    else {
        connectionsById[toReturn.id].packets.push(packet);
        connectionsById[toReturn.id].num++;
        connectionsById[toReturn.id].len += packet.orig_len;
    }
}

function dissectApplicationLayer(packet, data, offset, parent) {
    var toReturn = null;
    if (parent.sport === 6600 || parent.dport === 6600)
        packet.prot = 'MPD';
    else if (parent.sport === 80 || parent.dport === 80) {
        toReturn = new HTTPh(data, offset, parent);
        packet.class = 'HTTP';
        if (!toReturn.headers)
            toReturn = null;
        else
            packet.prot = 'HTTP';
    }
    return toReturn;
/*  if (offset < ph.incl_len) {
        var buff = new Uint8Array(msg.data, offset);
        buff = String.fromCharCode.apply(String, buff);
        info += buff;
    }
    if (tl.sport === 6600 || tl.dport === 6600) {
        prot = 'MPD';
        info += buff;
    }
    else if(buff === 'GET ' || buff ==='HTTP') {
        prot = 'HTTP';
        tr_class = 'http';
    }*/    
} 

function getDissectedPacket(num) {
    return dissectedPackets[num - 1];
}

function getDissectedPackets() {
    return dissectedPackets;
}

function getConnectionById(id) {
    return connectionsById[id];
}

function getConnectionsById() {
    return connectionsById;
}

function getConnectionsByArrival() {
    return connectionsByArrival;
}

function getRawPacket(num) {
    return rawPackets[num - 1];
}

function getRawPackets() {
    return rawPackets;
}

if (typeof module !== 'undefined') {
    module.exports.dissect = dissect;
    module.exports.getConnectionsById = getConnectionsById;
}
