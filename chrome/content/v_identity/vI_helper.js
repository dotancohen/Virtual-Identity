var vI_helper = {
	// "accountname" property changed in Thunderbird 3.x, Seamonkey 1.5x to "description"
	getAccountname: function(elem) {
		if (elem.getAttribute("accountname") == "" && elem.getAttribute("description") != "")
			return "- " + elem.getAttribute("description")
		else return elem.getAttribute("accountname")
	},

	combineNames : function (fullName, email) {
		if (fullName && fullName.replace(/^\s+|\s+$/g,"")) return fullName.replace(/^\s+|\s+$/g,"") + " <" + email.replace(/^\s+|\s+$/g,"") + ">"
		else return email?email.replace(/^\s+|\s+$/g,""):""
	},

	addIdentityMenuItem: function(object, identityName, accountName, accountKey, identityKey, base_id_key, smtp_key, extra) {
		var MenuItem = document.createElement("menuitem");
		MenuItem.className = "identity-popup-item";
		
		// set the account name in the choosen menu item
		MenuItem.setAttribute("label", identityName);
		MenuItem.setAttribute("accountname", accountName);
		MenuItem.setAttribute("accountkey", accountKey);
		MenuItem.setAttribute("value", identityKey);
		MenuItem.setAttribute("class", "identity_clone-popup-item new-icon")
		if (base_id_key) MenuItem.setAttribute("base_id_key", base_id_key)
		if (smtp_key) MenuItem.setAttribute("smtp_key", smtp_key)
		if (extra) MenuItem.setAttribute("extra", extra)
		
		object.appendChild(MenuItem)
		
		return MenuItem
	},

	getBaseIdentity : function () {
		return gAccountManager.getIdentity(vI.elements.Obj_MsgIdentity.value);
	},
	
	getAddress : function() {
		vI_msgIdentityClone.initMsgIdentityTextbox_clone();
		return vI_helper.parseAddress(vI_msgIdentityClone.elements.Obj_MsgIdentityTextbox_clone.value);
	},
	
	parseAddress : function(address) {
		//~ vI_notificationBar.dump("## v_identity: getAddress: parsing '" + address + "'\n")
		var name = ""; email = "";
		// prefer an email address separated with < >, only if not found use any other
		if (address.match(/<\s*[^>\s]*@[^>\s]*\s*>/) || address.match(/<?\s*[^>\s]*@[^>\s]*\s*>?/) || address.match(/$/)) {
			name = RegExp.leftContext + RegExp.rightContext
			email = RegExp.lastMatch
			email = email.replace(/\s+|<|>/g,"")
			name = name.replace(/^\s+|\s+$/g,"")
		}
		vI_notificationBar.dump("## v_identity: getAddress: address '" + address + "' name '" + 
			name + "' email '" + email + "'\n");
		return { name: name,
			 email: email,
			 combinedName: vI_helper.combineNames(name, email)}
	}
}