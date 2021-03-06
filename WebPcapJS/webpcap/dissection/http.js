'use strict';

function HTTP(littleEndian, packet, data, offset, parent) {
    packet.class = 'HTTP';
    
    data = data.buffer; // FIXME not working with DataView, change that later
    this.success = true; // indicator for successful dissection
    
    if (data.byteLength - offset < 4) {
        this.success = false;
        return; // stop right here
    }
    
    var stringView = String.fromCharCode.apply(null, 
                                               new Uint8Array(data, offset, 4));

    switch(stringView) {
    case 'GET ':
    case 'HEAD':
    case 'POST':
        this.type = 'Request';
        this.processHeaders(String.fromCharCode.apply(null, new Uint8Array(data, offset)), parent);
        break;
    case 'HTTP':
        this.type = 'Response';
        this.processHeaders(String.fromCharCode.apply(null, new Uint8Array(data, offset)));
        break;
    default:
        this.success = false;
        return; // stop right here
    }
    
    // set some general information
    packet.prot = 'HTTP';
    packet.info = this.toString();
    
    this.next_header = null;
}

HTTP.prototype = {
    getHeaderLength: function () {
        return this.hlen;
    },
    processHeaders: function (stringView, parent) {
        var tokens = stringView.split(/\n|\r\n/); // accept \n alone as well
        
        this.hlen = 0
        this.headers = [];
        
        for (var i = 0; i < tokens.length; i++) {
            if (tokens[i].length === 0) {
                this.hlen += 2;
                return;
            }
            this.hlen += tokens[i].length + 2;
            this.headers.push(tokens[i]);
        }
        
        this.success = false;
    },
    printDetails: function (pkt_num) {
        var details = document.createElement('div');
        details.setAttribute('class','http');
        var check = document.createElement('input');
        check.setAttribute('type','checkbox');  
        check.setAttribute('id', 'hd');
        var hidden = document.createElement('div');
        var label = document.createElement('label');
        var icon = document.createElement('span');
        icon.setAttribute('class', 'dropdown glow');
        label.setAttribute('for', 'hd');
        label.appendChild(icon);
        label.innerHTML += 'Hypertext Transfer Protocol';
        details.appendChild(check);
        details.appendChild(label);   
         
        hidden.innerHTML = 'Header length: ' + this.hlen + '</br>';
        
        for (var i = 0; i < this.headers.length; i++)
            hidden.innerHTML += this.headers[i] + '</br>';
                                 
        details.appendChild(hidden);
        
        return details;
    },
    toString: function () {
        return this.headers[0];
    }
};

if (typeof module !== 'undefined') {
    module.exports.HTTP = HTTP;
}