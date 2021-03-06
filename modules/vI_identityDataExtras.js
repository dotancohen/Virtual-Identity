/* ***** BEGIN LICENSE BLOCK *****
    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program; if not, write to the Free Software
    Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA

    The Original Code is the Virtual Identity Extension.

    The Initial Developer of the Original Code is Rene Ejury.
    Portions created by the Initial Developer are Copyright (C) 2007
    the Initial Developer. All Rights Reserved.

    Contributor(s): 
 * ***** END LICENSE BLOCK ***** */

var EXPORTED_SYMBOLS = ["identityDataExtras", "registerIdExtrasObject", "identityDataExtrasObject", "identityDataExtrasCheckboxObject"];

const {classes: Cc, interfaces: Ci, utils: Cu, results : Cr} = Components;

Cu.import("resource://v_identity/vI_log.js");
Cu.import("resource://v_identity/vI_prefs.js");

let Log = setupLogging("virtualIdentity.identityDataExtras");

let stringBundle = Cc["@mozilla.org/intl/stringbundle;1"]
  .getService(Ci.nsIStringBundleService)
  .createBundle("chrome://v_identity/locale/vI_storageExtras.properties");

let idExtrasObjects = [];

function registerIdExtrasObject(h) {
  idExtrasObjects.push(h);
}

function identityDataExtras(rdfDatasource, resource) {
  this.extras = [];
  let currentWindow = Cc["@mozilla.org/appshell/window-mediator;1"]
    .getService(Ci.nsIWindowMediator)
    .getMostRecentWindow(null);
  for each (let [, identityDataExtrasObject] in Iterator(idExtrasObjects)) {
    this.extras.push(new identityDataExtrasObject(currentWindow));
  }
  if (rdfDatasource)
    this.loopThroughExtras(
      function (extra) {
        extra.value = rdfDatasource._getRDFValue(resource, extra.field);});
}
identityDataExtras.prototype = {
  loopThroughExtras : function(k, returnVal) {
    for( var i = 0; i < this.extras.length; i++ ) {
      try {
        returnVal = k(this.extras[i], i, returnVal)
      }
      catch (e) {
        Log.warn("identityDataExtras '" + this.extras[i].field + "' returned an error:", e);
        dumpCallStack(e);
      }
    }
    return returnVal;
  },
  
  // just give a duplicate of the current identityDataExtras, else we will work with pointers
  getDuplicate : function() {
    var newExtras = new identityDataExtras();
    this.loopThroughExtras(function (extra, i) {
      newExtras.extras[i].value = extra.value;
    });
    return newExtras;
  },
    
  // copys all values of an identity. This way we can create a new object with a different document-context
  copy : function(extras) {
    this.loopThroughExtras(function (extra, i) {
      extra.value = extras.extras[i].value;
    });
  },

  equal : function(identityDataExtras) {
    var returnVal = true;
    return this.loopThroughExtras(function (extra, i, returnVal) {
      return extra.active?(extra.equal(identityDataExtras.extras[i]) && returnVal):returnVal;
    }, returnVal);
  },
  
  getMatrix : function() {
    var returnVal = "";
    return this.loopThroughExtras(function (extra, i, returnVal) {
      if (extra.active && extra.valueHtml)
        returnVal += "<tr>" +
          "<td class='col1 extras '>" + stringBundle.GetStringFromName("vident.identityData.extras." + extra.field) + "</td>" +
          "<td class='col2 extras '>" + extra.valueHtml + "</td>" +
          "</tr>"
      return returnVal;
    }, returnVal);
  },

  getCompareMatrix : function() {
    var returnVal = "";
    return this.loopThroughExtras(function (extra, i, returnVal) {
      if (extra.active) {
        var classEqual = (extra.lastCompareResult)?"equal":"unequal";
        returnVal += "<tr>" +
        "<td class='col1 extras " + classEqual + "'>" + stringBundle.GetStringFromName("vident.identityData.extras." + extra.field) + "</td>" +
        "<td class='col2 extras " + classEqual + "'>" + extra.lastCompareValue + "</td>" +
        "<td class='col3 extras " + classEqual + "'>" + extra.valueHtml + "</td>" +
        "</tr>"
      }
      return returnVal
    }, returnVal);
  },

  status : function() {
    var returnVal = "";
    return this.loopThroughExtras(function (extra) {
      return returnVal += returnVal?" ":"" + extra.status;
    }, returnVal);
  },

  readIdentityValues : function(identity) {
    this.loopThroughExtras(function (extra) {
      extra.readIdentityValue(identity)
    });
  },

  setValuesToEnvironment : function() {
    this.loopThroughExtras(function (extra) {
      extra.setValueToEnvironment()
    });
  },
  
  getValuesFromEnvironment : function() {
    this.loopThroughExtras(function (extra) {
      extra.getValueFromEnvironment()
    });
  },
  
  // add value's to the pref object, required for rdfDataTreeCollection
  addPrefs : function(pref) {
    this.loopThroughExtras(function (extra) {
      pref[extra.field + "Col"] = extra.valueNice;
    });
  }
}

function identityDataExtrasObject(currentWindow) {
  this.currentWindow = currentWindow;
}
identityDataExtrasObject.prototype = {
  value :   null,   // will contain the current value of the object and can be accessed from outside
  field :   null,   // short description of the field
  option :  null,   // option from preferences, boolean
  window :  null,   // the current Window the object was created for
  
  lastCompareValue : "",
  lastCompareResult : false,

  get valueHtml() {
      if (!this.value)
        return "";
      return  "<div class='bool" + ((this.value=="true")?" checked":"") + "'>" +
              "<label class='screen'>&nbsp;</label>" +
              "<label class='braille'>" + this.valueNice + "</label>" +
          "</div>"
  },
  get valueNice() {
      if (!this.value)
        return "";
      return (this.value=="true")?"yes":"no";
  },
  get status() {
    if (this.active && this.value)
      return this.field + "='" + this.value + "'";
    return "";
  },
  get active() { return vIprefs.get("storage") && vIprefs.get(this.option) },
  equal : function(compareIdentityDataExtrasObject) {
    this.lastCompareValue = compareIdentityDataExtrasObject.valueHtml;
    this.lastCompareResult = (!this.value || !compareIdentityDataExtrasObject.value || this.value == compareIdentityDataExtrasObject.value);
    if (!this.lastCompareResult) {
      Log.debug("extras not equal "+ this.field + " ('" + this.value + "' != '" + compareIdentityDataExtrasObject.value + "')");
    }
    return this.lastCompareResult;
  },
  // function to read the value from a given identity (probably not part of identity)
  readIdentityValue : function(identity) { },
  // function to set or read the value from/to the environment
  setValueToEnvironment : function() {
    let id = this.currentWindow.document.documentElement.id;
    switch(id) {
      case "msgcomposeWindow":
        this.setValueToEnvironment_msgCompose();
        break;
      case "messengerWindow":
        this.setValueToEnvironment_messenger();
        break;
      case "vI_rdfDataTreeWindow":
      case "vI_rdfDataEditor":
        this.setValueToEnvironment_dataEditor();
        break;
      default:
        Log.error("getValueFromEnvironment unknown window: " + id)
    }
  },
  getValueFromEnvironment : function() {
    let id = this.currentWindow.document.documentElement.id;
    switch(id) {
      case "msgcomposeWindow":
        this.getValueFromEnvironment_msgCompose();
        break;
      case "messengerWindow":
        this.getValueFromEnvironment_messenger();
        break;
      case "vI_rdfDataTreeWindow":
      case "vI_rdfDataEditor":
        this.getValueFromEnvironment_dataEditor();
        break;
      default:
        Log.error("getValueFromEnvironment unknown window: " + id)
    }
  },
  setValueToEnvironment_msgCompose : function() {
    Log.error("setValueToEnvironment not implemented for msgCompose and " + this.field)
  },
  setValueToEnvironment_messenger : function() {
    Log.error("setValueToEnvironment not implemented for Messenger and " + this.field)
  },
  setValueToEnvironment_dataEditor : function() {
    Log.error("setValueToEnvironment not implemented for dataEditor and " + this.field)
  },
  getValueFromEnvironment_msgCompose : function() {
    Log.error("setValueToEnvironment not implemented for msgCompose and " + this.field)
  },
  getValueFromEnvironment_messenger : function() {
    Log.error("setValueToEnvironment not implemented for Messenger and " + this.field)
  },
  getValueFromEnvironment_dataEditor : function() {
    Log.error("setValueToEnvironment not implemented for dataEditor and " + this.field)
  }
}


function identityDataExtrasCheckboxObject(currentWindow) {
  this.currentWindow = currentWindow;
}
identityDataExtrasCheckboxObject.prototype = {
  __proto__: identityDataExtrasObject.prototype,
  
  updateFunction_msgCompose : function() {},
  elementID_msgCompose : null,
  
  readIdentityValue : function(identity) { 
    if (this.active)
      this.value = (this.func_valueFromIdentity(identity))?"true":"false";
  },

  setValueToEnvironment_msgCompose: function() {
    var element = this.currentWindow.document.getElementById(this.elementID_msgCompose);
    if (!this.active || (this.value == null) || !element)
      return;
    
    this.updateFunction_msgCompose();
    if ((element.getAttribute("checked") == "true") != (this.value == "true")) {
      Log.debug("change "+ this.field + " to " + this.value + " with doCommand");
      element.doCommand();
    }
  },
  
  setValueToEnvironment_dataEditor: function() {
    if (this.value != null) {
      this.currentWindow.document.getElementById("vI_" + this.option).setAttribute("checked", this.value);
      this.currentWindow.document.getElementById("vI_" + this.option + "_store").setAttribute("checked", "true");
    }
    this.currentWindow.document.getElementById("vI_" + this.option + "_store").doCommand();
  },
  
  getValueFromEnvironment_msgCompose: function() {
    var element = this.currentWindow.document.getElementById(this.elementID_msgCompose)
    if (this.active && element) {
      this.updateFunction_msgCompose();
      this.value = ((element.getAttribute("checked") == "true")?"true":"false");
    }
  },
  
  getValueFromEnvironment_dataEditor: function() {
    if (this.currentWindow.document.getElementById("vI_" + this.option + "_store").getAttribute("checked") == "true") {
      var elementValue = this.currentWindow.document.getElementById("vI_" + this.option).getAttribute("checked");
      this.value = (elementValue == "true")?"true":"false"
    }
    else
      this.value = null;
  }
}