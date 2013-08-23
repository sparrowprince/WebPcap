'use strict';

if (typeof require !== 'undefined') {
    var printNum = require('../formattedoutput').printNum;
    var printMAC = require('./ethernet').printMAC;
    var printEtherType = require('./ethernet').printEtherType;
}

/*
 ******************************************************************
 ******************* LINUX 'COOKED' CAPTURE ***********************
 ******************************************************************
 */

function SLL(littleEndian, dataView, offset) {    
    this.type    = dataView.getUint16(offset, littleEndian);                 // packet type
    this.llat    = dataView.getUint16(offset + 2, littleEndian);                 // link-layer address type
    this.llal    = dataView.getUint16(offset + 4, littleEndian);                 // link-layer address length
    this.src     = new DataView(dataView.buffer, offset + 6, this.llal); // source (MAC) address    
    this.prot    = dataView.getUint16(offset + 14, littleEndian);                 // protocol (i.e. IPv4)
    
    this.next_header = null;
}

SLL.prototype = {
    getHeaderLength: function () {
        return SLL.HEADER_LENGTH;
    },
    printDetails: function (pkt_num) {
        var details = document.createElement('div');
        details.setAttribute('class','eth');
        var check = document.createElement('input');
        check.setAttribute('type','checkbox');  
        check.setAttribute('id', 'ed');
        var hidden = document.createElement('div');
        var label = document.createElement('label');
        var icon = document.createElement('span');
        icon.setAttribute('class', 'dropdown glow');
        label.setAttribute('for', 'ed');
        label.appendChild(icon);
        label.innerHTML += 'Linux cooked capture';
        details.appendChild(check);
        details.appendChild(label);   
        
        hidden.innerHTML += 'Packet type: ' + printPacketType(this.type) + ' (' + this.type + ')</br>';
        hidden.innerHTML += 'Link-layer address type: ' + this.llat + '</br>';
        hidden.innerHTML += 'Link-layer address length: ' + this.llal + '</br>';
        hidden.innerHTML += 'Source: ' + printMAC(this.src) + '</br>';
        hidden.innerHTML += 'Protocol: ' + printEtherType(this.prot) + ' (0x' + printNum(this.prot, 16, 4) + ')</br>';
        
        details.appendChild(hidden);
        
        return details;
    },
    toString: function () {
        return 'From:  ' + printMAC(this.src);
    }
};

function printPacketType(type) {
    switch(type) {
    case 0:  return 'Unicast to us';
    case 1:  return 'Broadcast';
    case 2:  return 'Multicast';
    case 3:  return 'Unicast to another host';
    case 4:  return 'Sent by us';
    default: return 'Unknown';
    }
}

SLL.HEADER_LENGTH = 16; // SLL header length in bytes

if (typeof module !== 'undefined') {
    module.exports.HEADER_LENGTH = SLL.HEADER_LENGTH;
    module.exports.SLL = SLL;
}