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

var EXPORTED_SYMBOLS = ["identityCollection", "identityData", "identityDataExtras", "DEFAULT_SMTP_TAG", "NO_SMTP_TAG"]

const DEFAULT_SMTP_TAG = "vI_useDefaultSMTP"
const NO_SMTP_TAG = "vI_noStoredSMTP"

Components.utils.import("resource://v_identity/vI_log.js");
let Log = setupLogging("virtualIdentity.identityData");
Components.utils.import("resource://v_identity/vI_prefs.js");
Components.utils.import("resource://v_identity/vI_accountUtils.js");

Components.utils.import("resource://v_identity/vI_identityDataExtras.js");
Components.utils.import("resource://v_identity/identityDataExtras/returnReceipt.js");
Components.utils.import("resource://v_identity/identityDataExtras/fccSwitch.js");
Components.utils.import("resource://v_identity/identityDataExtras/messageFormat.js");
Components.utils.import("resource://v_identity/identityDataExtras/characterEncoding.js");
Components.utils.import("resource://v_identity/identityDataExtras/sMimeEncryption.js");
Components.utils.import("resource://v_identity/identityDataExtras/sMimeSignature.js");
Components.utils.import("resource://v_identity/identityDataExtras/PGPEncryption.js");
Components.utils.import("resource://v_identity/identityDataExtras/PGPSignature.js");
Components.utils.import("resource://v_identity/identityDataExtras/PGPMIME.js");

function identityData(email, fullName, id, smtp, extras, sideDescription, existingID) {
	this._email = email?email:"";
	this._emailParsed = false;
	this._fullName = fullName?fullName:"";
	this.id = new idObj(id);
	this.smtp = new smtpObj(smtp);
	if (extras) this.extras = extras;
	else this.extras = new identityDataExtras();
	this.comp = {	// holds the results of the last comparison for later creation of a compareMatrix
		compareID : null,
		equals : { fullName : {}, email : {}, smtp : {}, id : {}, extras : {} }
	}
	if (sideDescription) this.sideDescription = sideDescription;
	if (existingID) this.existingID = existingID;
	else if (this.id.value) this.sideDescription = " - " + this.id.value;
	this.stringBundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
						.getService(Components.interfaces.nsIStringBundleService)
						.createBundle("chrome://v_identity/locale/v_identity.properties");
}
identityData.prototype = {
	_email : null,			// internal email-field might contain combinedName (until first queried via email)
	_fullName : null,
	_emailParsed : null,
	id : null,
	smtp : null,
	extras : null,
	sideDescription : null,
	existingID : null,		// indicates that this is a pre-defined Identity, which might handled slightly differently
	
	stringBundle : null,
	comp : null,	

	parseEmail : function() {
		if (this._emailParsed) return;
		// parse email and move any additional parts to fullName
		if (this._email.match(/<\s*[^>\s]*@[^>\s]*\s*>/) || this._email.match(/<?\s*[^>\s]*@[^>\s]*\s*>?/) || this._email.match(/$/)) {
			this._fullName += RegExp.leftContext + RegExp.rightContext;
			this._email = RegExp.lastMatch;
// 			Log.debug("parseEmail _fullName = '" + this._fullName + "'");
// 			Log.debug("parseEmail _email =    '" + this._email + "'");
		}
		this._emailParsed = true;
	},
	get email() {
		this.parseEmail();
		return (this._email?this._email.replace(/\s+|<|>/g,""):"");
	},
	set email(email) { this._email = email; this._emailParsed = false; },

	cleanName : function(fullName) {
// 		Log.debug("cleanName init '" + fullName + "'");
		var _fullName = fullName.replace(/^\s+|\s+$/g,"");
		if (_fullName.search(/^\".+\"$|^'.+'$/g) != -1) {
			_fullName = this.cleanName(_fullName.replace(/^\"(.+)\"$|^'(.+)'$/g,"$1$2"));
		}
// 		Log.debug("cleanName done '" + _fullName + "'");
		return _fullName;
	},

	get fullName() {
		this.parseEmail();
		return (this._fullName?this.cleanName(this._fullName):"")
	},
	set fullName(fullName) { this._fullName = fullName; },

	get combinedName() {
		var fullName = this.fullName; var email = this.email;
		return fullName?fullName+(email?" <"+email+">":""):email
	},
	set combinedName(combinedName) { this._email = combinedName; this._fullName = ""; this._emailParsed = false; },

	__makeHtml : function (string) { return string?string.replace(/>/g,"&gt;").replace(/</g,"&lt;"):"" },
	get idHtml() { return this.__makeHtml(this.id.value); },
	get smtpHtml() { return this.__makeHtml(this.smtp.value); },
	get fullNameHtml() { return this.__makeHtml(this.fullName); },
	get emailHtml() { return this.__makeHtml(this.email); },
	get combinedNameHtml() { return this.__makeHtml(this.combinedName); },

	get idLabel() { return this.stringBundle.GetStringFromName("vident.identityData.baseID") },
	get smtpLabel() { return this.stringBundle.GetStringFromName("vident.identityData.SMTP") },
	get fullNameLabel() { return this.stringBundle.GetStringFromName("vident.identityData.Name") },
	get emailLabel() { return this.stringBundle.GetStringFromName("vident.identityData.Address") },

	// creates an Duplicate of the current IdentityData, cause usually we are working with a pointer
	getDuplicate : function() {
		return new identityData(this.email, this.fullName, this.id.key, this.smtp.key, this.extras?this.extras.getDuplicate():null, this.sideDescription, this.existingID);
	},

	// copys all values of an identity. This way we can create a new object with a different document-context
	copy : function(identityData) {
		this.email = identityData.email;
		this.fullName = identityData.fullName;
		this.id.key = identityData.id.key;
		this.smtp.key = identityData.smtp.key;
		this.sideDescription = identityData.sideDescription;
		if (this.extras) this.extras.copy(identityData.extras);
	},

	// dependent on MsgComposeCommands, should/will only be called in ComposeDialog
	isExistingIdentity : function(ignoreFullNameWhileComparing) {
		Log.debug("isExistingIdentity: ignoreFullNameWhileComparing='" + ignoreFullNameWhileComparing + "'");
// 		Log.debug("base: fullName.toLowerCase()='" + this.fullName + "' email.toLowerCase()='" + this.email + "' smtp='" + this.smtp.key + "'");

		var ignoreFullNameMatchKey = null;
        var accounts = getAccountsArray();
        for (let acc = 0; acc < accounts.length; acc++) {
            let account = accounts[acc];
            try { prefroot.getBoolPref("mail.account."+account.key+".vIdentity"); continue; } catch (e) { };
            let identities = getIdentitiesArray(account);
            for (let i = 0; i < identities.length; i++) {
                let identity = identities[i];
// 				Log.debug("comp: fullName.toLowerCase()='" + identity.fullName.toLowerCase() + "' email.toLowerCase()='" + identity.email.toLowerCase() + "' smtp='" + identity.smtpServerKey + "'");
				var email = this.email?this.email:"";				// might be null if no identity is set
				var idEmail = identity.email?identity.email:"";	// might be null if no identity is set
				if (	(email.toLowerCase() == idEmail.toLowerCase()) &&
					this.smtp.equal(new smtpObj(identity.smtpServerKey))	) {
						// if fullName matches, than this is a final match
						if ( this.fullName.toLowerCase() == identity.fullName.toLowerCase() ) {
							Log.debug("isExistingIdentity: " + this.combinedName + " found, id='" + identity.key + "'");
							return identity.key; // return key and stop searching
						}
						// if fullNames don't match, remember the key but continue to search for full match
						else if (!ignoreFullNameMatchKey) ignoreFullNameMatchKey = identity.key;
				}
			}
		}

		if ( ignoreFullNameWhileComparing && ignoreFullNameMatchKey ) {
			Log.debug("isExistingIdentity: " + this.combinedName + " found, id='" + ignoreFullNameMatchKey + "'");
			return 	ignoreFullNameMatchKey;
		}

		Log.debug("isExistingIdentity: " + this.combinedName + " not found");
		return null;
	},
	
	equals : function(compareIdentityData) {
		this.comp.compareID = compareIdentityData;

		this.comp.equals.fullName = (((this.fullName)?this.fullName.toLowerCase():null) == ((compareIdentityData.fullName)?compareIdentityData.fullName.toLowerCase():null));
		if (!this.comp.equals.fullName) {
      Log.debug("fullName not equal ('" + ((this.fullName)?this.fullName.toLowerCase():null) + "' != '" + ((compareIdentityData.fullName)?compareIdentityData.fullName.toLowerCase():null) + "')");
    }
    this.comp.equals.email = (((this.email)?this.email.toLowerCase():null) == ((compareIdentityData.email)?compareIdentityData.email.toLowerCase():null));
    if (!this.comp.equals.email) {
      Log.debug("email not equal ('" + ((this.email)?this.email.toLowerCase():null) + "' != '" + ((compareIdentityData.email)?compareIdentityData.email.toLowerCase():null) + "')");
    }

		this.comp.equals.smtp = this.smtp.equal(compareIdentityData.smtp);
		this.comp.equals.id = this.id.equal(compareIdentityData.id);
		this.comp.equals.extras = this.extras?this.extras.equal(compareIdentityData.extras):true;
		
		return (this.comp.equals.fullName && this.comp.equals.email && this.comp.equals.smtp && this.comp.equals.id && this.comp.equals.extras);
	},

	equalsIdentity : function(compareIdentityData, getCompareMatrix) {
		var equal = this.equals(compareIdentityData);
		var compareMatrix = null;
 		// generate CompareMatrix only if asked and non-equal
		if (getCompareMatrix && !equal) compareMatrix = this.getCompareMatrix();
		return { equal : equal, compareMatrix : compareMatrix };
	},

	getCompareMatrix : function() {
		const Items = Array("fullName", "email", "smtp", "id");
		var string = "";
        var saveBaseId = vIprefs.get("storage_store_base_id");
        var saveSMTP = vIprefs.get("storage_store_SMTP");
        for each (let item in Items) {
			var classEqual = (this.comp.equals[item])?"equal":"unequal";
			var classIgnore = (((!saveBaseId) && (item == "id")) || ((!saveSMTP) && (item == "smtp")))?" ignoreValues":""
			string += "<tr>" +
				"<td class='col1 " + classEqual + "'>" + this[item+"Label"] + "</td>" +
				"<td class='col2 " + classEqual + classIgnore + "'>" + this.comp.compareID[item+"Html"] + "</td>" +
				"<td class='col3 " + classEqual + classIgnore + "'>" + this[item+"Html"] + "</td>" +
				"</tr>"
		}
		string += this.extras?this.extras.getCompareMatrix():"";
		return string;
	},

	getMatrix : function() {
		const Items = Array("smtp", "id");
		var string = "";
		for each (var item in Items) if (this[item+"Html"])
			string += "<tr><td class='col1'>" + this[item+"Label"] + ":</td>" +
				"<td class='col2'>" + this[item+"Html"] + "</td></tr>"
		string += this.extras?this.extras.getMatrix():"";
		return string;		
	}
}

function identityCollection() {
	this.number = 0;
	this.identityDataCollection = {};
	this.menuItems = {};
}
identityCollection.prototype =
{
	number : null,
	identityDataCollection : null,
	menuItems : null,
	
	mergeWithoutDuplicates : function(addIdentityCollection) {
		for (var index = 0; index < addIdentityCollection.number; index++)
			this.addWithoutDuplicates(addIdentityCollection.identityDataCollection[index])
	},

	dropIdentity : function(index) {
		Log.debug("dropping address from inputList: " + this.identityDataCollection[index].combinedName);
		while (index < (this.number - 1)) { this.identityDataCollection[index] = this.identityDataCollection[++index]; };
		this.identityDataCollection[--this.number] = null;
	},

	addWithoutDuplicates : function(identityData) {
		if (!identityData) return;
		for (var index = 0; index < this.number; index++) {
			if (this.identityDataCollection[index].email == identityData.email &&
				(!this.identityDataCollection[index].id.key || !identityData.id.key || 
					(this.identityDataCollection[index].id.key == identityData.id.key &&
					this.identityDataCollection[index].smtp.key == identityData.smtp.key))) {
				// found, so check if we can use the Name of the new field
				if (this.identityDataCollection[index].fullName == "" && identityData.fullName != "") {
					this.identityDataCollection[index].fullName = identityData.fullName;
					Log.debug("added fullName '" + identityData.fullName
						+ "' to stored email '" + this.identityDataCollection[index].email + "'")
				}
				// check if id_key, smtp_key or extras can be used
				// only try this once, for the first Identity where id is set)
				if (!this.identityDataCollection[index].id.key && identityData.id.key) {
					this.identityDataCollection[index].id.key = identityData.id.key;
					this.identityDataCollection[index].smtp.key = identityData.smtp.key;
					this.identityDataCollection[index].extras = identityData.extras;
					Log.debug("added id '" + identityData.id.value
						+ "' smtp '" + identityData.smtp.value + "' (+extras) to stored email '" + this.identityDataCollection[index].email + "'")
				}
				return;
			}
		}
		Log.debug("add new address to result: " + identityData.combinedName)
		this.identityDataCollection[index] = identityData;
		this.number = index + 1;
	},
	
	// this is used to completely use the conten of another identityCollection, but without changing all pointers
	// see for instance vI.smartIdentity.__filterAddresses
	takeOver : function(newIdentityCollection) {
		this.number = newIdentityCollection.number
		this.identityDataCollection = newIdentityCollection.identityDataCollection
	}
};

function smtpObj(key) {
	this._key = key;
	this.DEFAULT_TAG = 	Components.classes["@mozilla.org/intl/stringbundle;1"]
						.getService(Components.interfaces.nsIStringBundleService)
						.createBundle("chrome://messenger/locale/messenger.properties").
							GetStringFromName("defaultServerTag");
}
smtpObj.prototype = {
	DEFAULT_TAG : null,
	_key : null,
	_value : null,
	
	set key(key) { this._key = key; this._value = null; },
	get key() {
		var dummy = this.value; // just to be sure key is adapted if SMTP is not available
		return this._key
	},
	get keyNice() { // the same as key but with "" for DEFAULT_SMTP_TAG
		if (this.key == DEFAULT_SMTP_TAG) return ""; // this is the key used for default server
		return this.key
	},
	get value() {
		if (this._value == null) {
			this._value = "";
			if (this._key == null || this._key == "") this._key = DEFAULT_SMTP_TAG;
			if (this._key == DEFAULT_SMTP_TAG) this._value = this.DEFAULT_TAG;
			else if (!this._key) this._value = null;
			else if (this._key) {
				var servers = Components.classes["@mozilla.org/messengercompose/smtp;1"]
					.getService(Components.interfaces.nsISmtpService).smtpServers;
				while (servers && servers.hasMoreElements()) {
					var server = servers.getNext();
					if (server instanceof Components.interfaces.nsISmtpServer && 
						!server.redirectorType && this._key == server.key) {
						this._value = server.description?server.description:server.hostname;
						break;
					}
				}
			}
		}
		if (!this._value) this._key = NO_SMTP_TAG; // if non-existant SMTP handle like non available
		return this._value;
	},
	equal : function(compareSmtpObj) {
		if (this.key == NO_SMTP_TAG || compareSmtpObj.key == NO_SMTP_TAG) return true;
    if (this.keyNice != compareSmtpObj.keyNice) {
      Log.debug("smtp not equal ('" + this.keyNice + "' != '" + compareSmtpObj.keyNice + "')");
    }
		return (this.keyNice == compareSmtpObj.keyNice);
	},
	hasNoDefinedSMTP : function() {
		return (this.key == NO_SMTP_TAG);
	}
}

function idObj(key) { this._key = key; }
idObj.prototype = {
	_key : null,
	_value : null,

	set key(key) { this._key = key; this._value = null; },
	get key() { if (this._value == null) var dummy = this.value; return this._key },
	get value() {
		if (this._value == null) {
			this._value = "";
            // if this worked we are having at least seamonkey 1.17
            accounts = getAccountsArray();
            for (let acc = 0; acc < accounts.length; acc++) {
                let account = accounts[acc];
                let identities = getIdentitiesArray(account);
                if (identities.length == 0)
                    continue;
                for (let i = 0; i < identities.length; i++) {
                    let identity = identities[i];
                    if (this._key == identity.key) {
                        this._value = identity.identityName;
                        break;
                    }
                }
            }
            if (!this._value) this._key = null;
		}
		return this._value;
	},
	equal : function(compareIdObj) {
		if (!this.key || !compareIdObj.key) return true;
    if (this.key != compareIdObj.key) {
      Log.debug("id not equal ('" + this.key + "' != '" + compareIdObj.key + "')");
    }
		return (this.key == compareIdObj.key);
	}
}