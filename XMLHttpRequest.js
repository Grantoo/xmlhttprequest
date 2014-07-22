/**
* XMLHttpRequest.js Copyright (C) 2011 Sergey Ilinsky (http://www.ilinsky.com)
*
* This work is free software; you can redistribute it and/or modify
* it under the terms of the GNU Lesser General Public License as published by
* the Free Software Foundation; either version 2.1 of the License, or
* (at your option) any later version.
*
* This work is distributed in the hope that it will be useful,
* but without any warranty; without even the implied warranty of
* merchantability or fitness for a particular purpose. See the
* GNU Lesser General Public License for more details.
*
* You should have received a copy of the GNU Lesser General Public License
* along with this library; if not, write to the Free Software Foundation, Inc.,
* 59 Temple Place, Suite 330, Boston, MA 02111-1307 USA
*/

(function () {

  // Save reference to earlier defined object implementation (if any)
  var oXMLHttpRequest = window.XMLHttpRequest;

  // Define on browser type
  var bGecko  = !!window.controllers;

  // Enables "XMLHttpRequest()" call next to "new XMLHttpRequest()"
  function fXMLHttpRequest() {
    if (window.XMLHttpRequest.isNormalizedObject) {
      this._object = new oXMLHttpRequest();
    } // otherwise use whatever is currently referenced by XMLHttpRequest
    else {
      this._object = new window.XMLHttpRequest();
    }
    this._listeners = [];
  }

  // Constructor
  function cXMLHttpRequest() {
    return new fXMLHttpRequest;
  }
  cXMLHttpRequest.prototype = fXMLHttpRequest.prototype;

  if (oXMLHttpRequest.wrapped) {
    cXMLHttpRequest.wrapped = oXMLHttpRequest.wrapped;
  }

  // Marker to be able to easily identify our object
  cXMLHttpRequest.isNormalizedObject = true;

  // Constants
  cXMLHttpRequest.UNSENT            = 0;
  cXMLHttpRequest.OPENED            = 1;
  cXMLHttpRequest.HEADERS_RECEIVED  = 2;
  cXMLHttpRequest.LOADING           = 3;
  cXMLHttpRequest.DONE              = 4;

  // Interface level constants
  cXMLHttpRequest.prototype.UNSENT            = cXMLHttpRequest.UNSENT;
  cXMLHttpRequest.prototype.OPENED            = cXMLHttpRequest.OPENED;
  cXMLHttpRequest.prototype.HEADERS_RECEIVED  = cXMLHttpRequest.HEADERS_RECEIVED;
  cXMLHttpRequest.prototype.LOADING           = cXMLHttpRequest.LOADING;
  cXMLHttpRequest.prototype.DONE              = cXMLHttpRequest.DONE;

  // Public Properties
  cXMLHttpRequest.prototype.readyState    = cXMLHttpRequest.UNSENT;
  cXMLHttpRequest.prototype.responseText  = '';
  cXMLHttpRequest.prototype.responseXML   = null;
  cXMLHttpRequest.prototype.status        = 0;
  cXMLHttpRequest.prototype.statusText    = '';

  // Priority proposal
  cXMLHttpRequest.prototype.priority    = "NORMAL";

  // Instance-level Events Handlers
  cXMLHttpRequest.prototype.onreadystatechange  = null;

  // Class-level Events Handlers
  cXMLHttpRequest.onreadystatechange  = null;
  cXMLHttpRequest.onopen              = null;
  cXMLHttpRequest.onsend              = null;
  cXMLHttpRequest.onabort             = null;
  cXMLHttpRequest.prototype.retryCounter = 0;

  // Public Methods
  cXMLHttpRequest.prototype.open  = function(sMethod, sUrl, bAsync, sUser, sPassword) {
    // http://www.w3.org/TR/XMLHttpRequest/#the-open-method
    var sLowerCaseMethod = sMethod.toLowerCase();
    if (sLowerCaseMethod == "connect" || sLowerCaseMethod == "trace" || sLowerCaseMethod == "track") {
      // Using a generic error and an int - not too sure all browsers support correctly
      // http://dvcs.w3.org/hg/domcore/raw-file/tip/Overview.html#securityerror, so, this is safer
      // XXX should do better than that, but this is OT to XHR.
      throw new Error(18);
    }

    // Delete headers, required when object is reused
    delete this._headers;

    // When bAsync parameter value is omitted, use true as default
    if (arguments.length < 3) {
      bAsync  = true;
    }

    // Save async parameter for fixing Gecko bug with missing readystatechange in synchronous requests
    this._async   = bAsync;
    // save arguments for retry
    this.retryArguments = arguments;

    // Set the onreadystatechange handler
    var oRequest      = this;
    var nState        = this.readyState;
    var fOnUnload     = null;

    // Add method sniffer
    if (cXMLHttpRequest.onopen) {
      cXMLHttpRequest.onopen.apply(this, arguments);
    }

    if (arguments.length > 4) {
      this._object.open(sMethod, sUrl, bAsync, sUser, sPassword);
    } else if (arguments.length > 3) {
      this._object.open(sMethod, sUrl, bAsync, sUser);
    } else {
      this._object.open(sMethod, sUrl, bAsync);
    }
    this._object.retryCounter = this.retryCounter;

    this.readyState = cXMLHttpRequest.OPENED;
    fReadyStateChange(this);

    this._object.onreadystatechange = function() {
      if (bGecko && !bAsync) {
        return;
      }

      // Synchronize state
      oRequest.readyState   = oRequest._object.readyState;
      fSynchronizeValues(oRequest);

      // BUGFIX: Firefox fires unnecessary DONE when aborting
      if (oRequest._aborted) {
        // Reset readyState to UNSENT
        oRequest.readyState = cXMLHttpRequest.UNSENT;

        // Return now
        return;
      } else if (oRequest.status !== 200) {
        if (this.retryCounter < 1) {
          var retry = new window.XMLHttpRequest();
          retry.retryCounter = this.retryCounter + 1;
          retry.open.apply(retry, oRequest.retryArguments);
          retry.onload = function() {
            fSynchronizeRetryValues(oRequest, retry);
            oRequest.onload();
          }
          retry.onabort = oRequest.onabort;
          oRequest.onabort = null;
          oRequest.abort();
          retry.send.apply(retry, oRequest._data);
          if (oRequest._async) {
            fQueue_remove(oRequest);
          }
          return;
        }
      }

      if (oRequest.readyState == cXMLHttpRequest.DONE) {
        // Free up queue
        delete oRequest._data;

        // Uncomment these lines for bAsync
        if (bAsync) {
          fQueue_remove(oRequest);
        }

        // BUGFIX: Some browsers (Internet Explorer, Gecko) fire OPEN readystate twice
        if (nState != oRequest.readyState) {
          fReadyStateChange(oRequest);
        }

        nState  = oRequest.readyState;

        if (oRequest.onload && oRequest.readyState != cXMLHttpRequest.RETRY) {
          oRequest.onload();
        }
      }
    };
  };

  cXMLHttpRequest.prototype.send = function(vData) {
    // Add method sniffer
    if (cXMLHttpRequest.onsend) {
      cXMLHttpRequest.onsend.apply(this, arguments);
    }

    if (!arguments.length) {
      vData = null;
    }

    // BUGFIX: Safari - fails sending documents created/modified dynamically, so an explicit serialization required
    // BUGFIX: IE - rewrites any custom mime-type to "text/xml" in case an XMLNode is sent
    // BUGFIX: Gecko - fails sending Element (this is up to the implementation either to standard)
    if (vData && vData.nodeType) {
      vData = window.XMLSerializer ? new window.XMLSerializer().serializeToString(vData) : vData.xml;
      if (!this._headers["Content-Type"]) {
        this._object.setRequestHeader("Content-Type", "application/xml");
      }
    }

    this._data = vData;

    // Add to queue
    if (this._async) {
      fQueue_add(this);
    } else {
      fXMLHttpRequest_send(this);

    }
  };

  cXMLHttpRequest.prototype.abort = function() {
    // Add method sniffer
    if (cXMLHttpRequest.onabort) {
      cXMLHttpRequest.onabort.apply(this, arguments);
    }

    // BUGFIX: Gecko - unnecessary DONE when aborting
    if (this.readyState > cXMLHttpRequest.UNSENT) {
      this._aborted = true;
    }

    this._object.abort();

    this.readyState = cXMLHttpRequest.UNSENT;

    delete this._data;

    if (this._async) {
      fQueue_remove(this);
    }
  };

  cXMLHttpRequest.prototype.getAllResponseHeaders = function() {
    return this._object.getAllResponseHeaders();
  };

  cXMLHttpRequest.prototype.getResponseHeader = function(sName) {
    return this._object.getResponseHeader(sName);
  };

  cXMLHttpRequest.prototype.setRequestHeader  = function(sName, sValue) {
    // BUGFIX: IE - cache issue
    if (!this._headers) {
      this._headers = {};
    }

    this._headers[sName]  = sValue;

    return this._object.setRequestHeader(sName, sValue);
  };

  // EventTarget interface implementation
  cXMLHttpRequest.prototype.addEventListener  = function(sName, fHandler, bUseCapture) {
    for (var nIndex = 0, oListener; oListener = this._listeners[nIndex]; nIndex++) {
      if (oListener[0] == sName && oListener[1] == fHandler && oListener[2] == bUseCapture) {
        return;
      }
    }

    // Add listener
    this._listeners.push([sName, fHandler, bUseCapture]);
  };

  cXMLHttpRequest.prototype.removeEventListener = function(sName, fHandler, bUseCapture) {
    for (var nIndex = 0, oListener; oListener = this._listeners[nIndex]; nIndex++) {
      if (oListener[0] == sName && oListener[1] == fHandler && oListener[2] == bUseCapture) {
        break;
      }
    }

    // Remove listener
    if (oListener) {
      this._listeners.splice(nIndex, 1);
    }
  };

  cXMLHttpRequest.prototype.dispatchEvent = function(oEvent) {
    var oEventPseudo  = {
      'type':             oEvent.type,
      'target':           this,
      'currentTarget':    this,
      'eventPhase':       2,
      'bubbles':          oEvent.bubbles,
      'cancelable':       oEvent.cancelable,
      'timeStamp':        oEvent.timeStamp,
      'stopPropagation':  function() {},  // There is no flow
      'preventDefault':   function() {},  // There is no default action
      'initEvent':        function() {}   // Original event object should be initialized
    };

    // Execute onreadystatechange
    if (oEventPseudo.type == "readystatechange" && this.onreadystatechange) {
      (this.onreadystatechange.handleEvent || this.onreadystatechange).apply(this, [oEventPseudo]);
    }


    // Execute listeners
    for (var nIndex = 0, oListener; oListener = this._listeners[nIndex]; nIndex++) {
      if (oListener[0] == oEventPseudo.type && !oListener[2]) {
        (oListener[1].handleEvent || oListener[1]).apply(this, [oEventPseudo]);
      }
    }

  };

	//
  cXMLHttpRequest.prototype.toString  = function() {
    return '[' + "object" + ' ' + "XMLHttpRequest" + ']';
  };

  cXMLHttpRequest.toString  = function() {
    return '[' + "XMLHttpRequest" + ']';
  };

  // Queue manager
  var oQueuePending = {"CRITICAL": [], "HIGH": [], "NORMAL": [], "LOW": [], "LOWEST": []},
      aQueueRunning = [];

  function fQueue_add(oRequest) {
    oQueuePending[oRequest.priority in oQueuePending ? oRequest.priority : "NORMAL"].push(oRequest);
    setTimeout(fQueue_process);
  };

  function fQueue_remove(oRequest) {
    for (var nIndex = 0, bFound = false; nIndex < aQueueRunning.length; nIndex++)
      if (bFound) {
        aQueueRunning[nIndex - 1] = aQueueRunning[nIndex];
      } else {
        if (aQueueRunning[nIndex] == oRequest) {
          bFound = true;
        }
      }

    if (bFound) {
      aQueueRunning.length--;
    }

    setTimeout(fQueue_process);
  };

  function fQueue_process() {
    if (aQueueRunning.length < 6) {
      for (var sPriority in oQueuePending) {
        if (oQueuePending[sPriority].length) {
          var oRequest = oQueuePending[sPriority][0];
          oQueuePending[sPriority] = oQueuePending[sPriority].slice(1);
          //
          aQueueRunning.push(oRequest);
          // Send request
          fXMLHttpRequest_send(oRequest);
          break;
        }
      }
    }
  };

  // Helper function
  function fXMLHttpRequest_send(oRequest) {
    oRequest._object.send(oRequest._data);

    // BUGFIX: Gecko - missing readystatechange calls in synchronous requests
    if (bGecko && !oRequest._async) {
      oRequest.readyState = cXMLHttpRequest.OPENED;

      // Synchronize state
      fSynchronizeValues(oRequest);

      // Simulate missing states
      while (oRequest.readyState < cXMLHttpRequest.DONE) {
        oRequest.readyState++;
        fReadyStateChange(oRequest);
        // Check if we are aborted
        if (oRequest._aborted) {
          return;
        }
      }
    }
  }

  function fReadyStateChange(oRequest) {
    // Sniffing code
    if (cXMLHttpRequest.onreadystatechange){
      cXMLHttpRequest.onreadystatechange.apply(oRequest);
    }


    // Fake event
    oRequest.dispatchEvent({
      'type':       "readystatechange",
      'bubbles':    false,
      'cancelable': false,
      'timeStamp':  new Date().getTime()
    });
  }

  function fGetDocument(oRequest) {
    var oDocument = oRequest.responseXML;
    var sResponse = oRequest.responseText;
    // Try parsing responseText
    // Check if there is no error in document
    if (oDocument){
      if (!oDocument.documentElement || (oDocument.documentElement && oDocument.documentElement.tagName == "parsererror")) {
        return null;
      }
    }
    return oDocument;
  }

  function fSynchronizeValues(oRequest) {
    try { oRequest.responseText = oRequest._object.responseText;  } catch (e) {}
    try { oRequest.responseXML  = fGetDocument(oRequest._object); } catch (e) {}
    try { oRequest.status       = oRequest._object.status;        } catch (e) {}
    try { oRequest.statusText   = oRequest._object.statusText;    } catch (e) {}
  }

  function fSynchronizeRetryValues(oRequest, retry) {
    try { oRequest.readyState   = retry.readyState;    } catch (e) {}
    try { oRequest.responseText = retry.responseText;  } catch (e) {}
    try { oRequest.responseXML  = fGetDocument(retry._object); } catch (e) {}
    try { oRequest.status       = retry.status;        } catch (e) {}
    try { oRequest.statusText   = retry.statusText;    } catch (e) {}
  }

  // Register new object with window
  window.XMLHttpRequest = cXMLHttpRequest;

})();