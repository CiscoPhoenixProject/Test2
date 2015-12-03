/*************************************************************************** 
* Restlet_Eval_Provisioning
* ------------------- 
* Created By: Nikay Nipp, Arif Willis-Browne
* Created on: 30-04-2015
* Project name: INC000032732560 Instant Eval RESTlets
* Last Checked In By : Nikay Nipp
* Last Checked In On : 07-24-2015
* Revision No : <V 1.0>
* Type: restlet
* Description : Restlet to create records after Provisioning UI activates restlet URL.
* Request URL: https://rest.sandbox.netsuite.com/app/site/hosting/restlet.nl
* Authorization: NLAuth nlauth_account=772356_SB2,nlauth_email=ppryst@softserveinc.com, nlauth_signature=Softserve123,nlauth_role=1066
*****
* UPDATES/CHANGES
*
* 1. Prototype (Nikay Nipp)
**************************************************************************/

// Get a standard NetSuite record
// Query parameters: e.g. recordtype=customer&id=769
function GET_record_information(datain)
{
	try {
	    var results = new Object();
	    var filters = ['isinactive', 'is', 'F'];
	    var columns = [new nlobjSearchColumn('name')]; 	

	    //Base fuctions exposed, but not apart of any usecase
	    if (datain.list == 'customrecord_countries_2' || datain.list == 'customrecordnewstates')	// e.g list="customrecord_countries_2"
	    {
            switch (datain.list) {
            case 'customrecord_countries_2':
                columns.push(new nlobjSearchColumn('custrecord_country_abbreviation'));   	
                break;
            case 'customrecordnewstates':
                columns.push(new nlobjSearchColumn('custrecord_pcountry'));
                columns.push(new nlobjSearchColumn('custrecord_abrv'));
                columns.push(new nlobjSearchColumn('custrecord_state_abbreviation'));
                break;

            }
	        nlapiLogExecution('DEBUG', 'request list ' + datain.list);
	        results = nlapiSearchRecord( datain.list, null, filters, columns );
	
			nlapiLogExecution('DEBUG','data', JSON.stringify(results));
		 	return results;

		    //GET status code in usecase
	    } else if (datain.evalRequestId){
	    	var eval = nlapiLookupField('customrecord_salesorder_integration', datain.evalRequestId, ['custrecord_eval_sales_order', 'custrecord_completed', 'custrecord_partner_resellerid', 'custrecord_eval_entity']);
	    	var proxy = new Array();
	    	
	    	try {
		    	if (eval.custrecord_eval_sales_order != '3249'){//Hard coded Sales Order as default value
			    	var j = 0;
			 	   	var col2 = new Array();
			 	   	var filters2 = [];
			 	   	filters2.push( new nlobjSearchFilter('custrecord_sg_sales_order', null, 'anyof',  eval.custrecord_eval_sales_order) );
			 	   	filters2.push( new nlobjSearchFilter('custrecord_sg_primary_proxy', null, 'noneof', '@NONE@') );
			 	   	col2[0] = new nlobjSearchColumn('custrecord_sg_primary_proxy');
			 	   	col2[1] = new nlobjSearchColumn('custrecord_sg_secondary_proxy');	
			 	   	col2[2] = new nlobjSearchColumn('custrecord_sg_country');	//		 	   	
			 	   	col2[3] = new nlobjSearchColumn('custrecord_sg_state');			// 	   	
			 	   	var searchresults = nlapiSearchRecord('customrecord_sg_site', null, filters2, col2);
			
			 	   	for ( var i = 0; searchresults != null && i < searchresults.length; i++ ){
			 	   		var searchresult = searchresults[ i ];
			 	   		var routeId = searchresult.getText( 'custrecord_sg_primary_proxy' );
			 	   		var routeCountry = searchresult.getText( 'custrecord_sg_country' );//
			 	   		var routeState = searchresult.getText( 'custrecord_sg_state' );//			
			 	   		var proxies = new Object();
			 	   		proxies.host = routeId;
			 	   		proxies.port = 8080;
			 	   		proxies.priority = 1;
			 	   		proxies.country = routeCountry;//
			 	   		proxies.state = routeState;		//	
			 	   		proxy[j] = proxies;
			 	   		j = j + 1;
							
			 	   		var routeId2 = searchresult.getText( 'custrecord_sg_secondary_proxy' );
			 	   		var proxies2 = new Object();
			 	   		proxies2.host = routeId2;
			 	   		proxies2.port = 8080;
			 	   		proxies2.priority = 2;	
			 	   		proxies.country = routeCountry;//
			 	   		proxies.state = routeState;		//				
			 	   		proxy[j] = proxies2;
			 	   		j = j + 1;
				
			 	   	}   	    		
		    	} else {  //return nulls at first GET status = 1
		    		proxy = null;
		    		eval.custrecord_eval_sales_order = null;
		    	//nlapiLogExecution('DEBUG', 'GET proxy Data ', JSON.stringify(proxy));
		    	}
		    	
	    	} catch (e){
				nlapiLogExecution('DEBUG','data', JSON.stringify(e));
				//new email(nlapiGetContext(), nlapiGetRecordType(), nlapiGetRecordId(),  e, JSON.stringify(text)).send_error_email();

	    	}
	    	
	    	//construct return JSON
	 	   	var evalResponse = new Object();
	 	   	evalResponse.status = eval.custrecord_completed;
	 	   	evalResponse.proxies = proxy;
	 	   	//evalResponse.recordId = eval.custrecord_eval_entity || null;
	 	   	evalResponse.recordId = null;
	        if (Is_Not_Empty(eval.custrecord_eval_entity)) {
	        	evalResponse.recordId = nlapiLookupField('customer', eval.custrecord_eval_entity, 'entityid');	          
	        	}
	 	   	evalResponse.resellerId = eval.custrecord_partner_resellerid || null;

		 	return evalResponse ;

	    }  

	} catch (e){
        nlapiLogExecution('ERROR', 'Bad GET Data ', JSON.stringify(e));	
        new email(nlapiGetContext(), nlapiGetRecordType(), nlapiGetRecordId(),  e, JSON.stringify(e)).send_error_email();

	}
}

//To post a new record upon trigger of the external application.
function POST_new_record(datain)
{
  try {

   //POST step 1 create status  
   if (Is_Not_Empty(datain.createStatus)){
	   var record = nlapiCreateRecord('customrecord_salesorder_integration');
	   var Obj = nlapiSubmitRecord(record,true,true);

	   var evalRecord = nlapiCreateRecord('customrecord_eval_rest_request');	   
	   evalRecord.setFieldValue('custrecord_so_integration', Obj);	   
	   evalRecord.setFieldValue('custrecord_instant_eval_json', JSON.stringify(datain));
	   nlapiSubmitRecord(evalRecord,true,true);
	   
	   var retObj = new Object();
	   retObj.evalRequestId = Obj;
	   return retObj;
   } 
   //POST step 4 post activation URL in NetSuite
   if (Is_Not_Empty(datain.activationUrl)){
	   var evalRecord = nlapiCreateRecord('customrecord_eval_rest_request');	   
	   evalRecord.setFieldValue('custrecord_so_integration', datain.evalRequestId);	   
	   evalRecord.setFieldValue('custrecord_instant_eval_json', JSON.stringify(datain));
	   nlapiSubmitRecord(evalRecord,true,true);

	   var eval = nlapiLookupField('customrecord_salesorder_integration', datain.evalRequestId, ['custrecord_eval_sales_order']);

	   var filters = new Array();
       filters[0] = new nlobjSearchFilter('custrecord_sg_sales_order', null, 'anyof', eval.custrecord_eval_sales_order);
       filters[1] = new nlobjSearchFilter( 'isinactive', null, 'is', 'F' );
       var columns = [new nlobjSearchColumn('custrecord_sg_primary_proxy'),  new nlobjSearchColumn('custrecord_sg_secondary_proxy')];
       columns[0].setSort();
       var searchresults = nlapiSearchRecord( 'customrecord_sg_site', null, filters, columns);
       
       for ( var i = 0; searchresults != null && i < searchresults.length; i++ ) {
	   	var searchresult = searchresults[ i ];
		nlapiSubmitField('customrecord_sg_site', searchresult.id, ['custrecord_sg_sc_provisioned', 'custrecord_sg_date_provisioned'], ['T', nlapiDateToString(new Date(),'date')]);

        //nlapiLogExecution('DEBUG', 'SC Provision ', JSON.stringify(searchresult.id));
  
/*      
 	   var salesorderRecord = nlapiLoadRecord('salesorder', eval.custrecord_eval_sales_order);
	   salesorderRecord.setFieldValue('custbody_scancenter_id', datain.companyId);
	   salesorderRecord.setFieldValue('custbody_pp_login_url', datain.activationUrl);
	   //nlapiLogExecution('DEBUG','Start autofinalizer ', JSON.stringify(searchresults));		
	   salesorderRecord.setFieldValue('custbody_pp_primary_proxy_name', searchresults[0].getValue('custrecord_sg_primary_proxy'));
	   salesorderRecord.setFieldValue('custbody_pp_backup_proxy_name', searchresults[0].getValue('custrecord_sg_secondary_proxy'));
	   salesorderRecord.setFieldValue('custbody_pp_primary_ip_addr', searchresults[0].getText('custrecord_sg_primary_proxy'));
	   salesorderRecord.setFieldValue('custbody_pp_backup_ip_address', searchresults[0].getText('custrecord_sg_secondary_proxy'));
	   salesorderRecord.setFieldValue('custbody_pp_email_status', '1');//trigger auto finalizer workflow
	   nlapiSubmitRecord(salesorderRecord,true,true);
*/
		nlapiSubmitField('salesorder', eval.custrecord_eval_sales_order, 
				['custbody_scancenter_id', 'custbody_pp_login_url', 'custbody_pp_primary_proxy_name', 'custbody_pp_backup_proxy_name', 'custbody_pp_primary_ip_addr', 'custbody_pp_backup_ip_address', 'custbody_pp_email_status', 'startdate', 'custbody_email_template'], 
				[datain.companyId, datain.activationUrl, searchresults[0].getValue('custrecord_sg_primary_proxy'), searchresults[0].getValue('custrecord_sg_primary_proxy'), searchresults[0].getText('custrecord_sg_primary_proxy'), searchresults[0].getText('custrecord_sg_secondary_proxy'), '1',  nlapiDateToString(new Date(),'date'), '268']);


	   //Provision (on the deployment tab) keeping in mind, the existing SDM rules engine.
	   var filtersDep = new Array();
	   filtersDep[0] = new nlobjSearchFilter('custrecord_customer_tam', null, 'anyof', eval.custrecord_eval_sales_order);
	   filtersDep[1] = new nlobjSearchFilter( 'isinactive', null, 'is', 'F' );
	   var depResults = nlapiSearchRecord( 'customrecord_tam', null, filtersDep, null);	
		nlapiSubmitField('customrecord_tam', depResults[0].getId(), 'custrecord_tam_ready_for_provision', 'T');

        
	   	}  

	   var retObj = new Object();
	   retObj.status = 'Completed';
	   retObj.proxies = null;	
	   retObj.recordId = null;
	   retObj.resellerId = null;
	   return retObj;
   }  
   //POST step 2 create all entries in NetSuite
   if (Is_Not_Empty(datain.netsuiteModel)){
		//nlapiLogExecution('DEBUG','JSON data', JSON.stringify(datain) );
	   var evalId = datain.netsuiteModel.evalRequestId;

	   var evalRecord = nlapiCreateRecord('customrecord_eval_rest_request');	   
	   evalRecord.setFieldValue('custrecord_so_integration', evalId);	   
	   evalRecord.setFieldValue('custrecord_instant_eval_json', JSON.stringify(datain));
	   nlapiSubmitRecord(evalRecord,true,true);

		var breakPoints;
		if(datain.netsuiteModel.technicalInformation.multipleCountries){
			breakPoints = 1;
		} else {
			breakPoints = 2;				
		}	

       //@Arif Willis-Browne: check length of site location on JSON string 22/07/2015
       var get_site_length = datain.netsuiteModel.siteLocations.siteLocationList.length;

	   var defCountry1 = '';
	   var defCountry2 = '';
	   var defCountry3 = '';
	   var user1 = 0;
	   var user2 = 0;
	   var user3 = 0;	   
		switch (get_site_length){
		case 1:
			nlapiLogExecution('DEBUG','case ', '1' );
			   defCountry1 = datain.netsuiteModel.siteLocations.siteLocationList[0].country.substring(2);
			   user1 = datain.netsuiteModel.siteLocations.siteLocationList[0].numberOfUsers;
			   break;
		case 2:
			nlapiLogExecution('DEBUG','case ', '2' );
			   defCountry1 = datain.netsuiteModel.siteLocations.siteLocationList[0].country.substring(2);
			   defCountry2 = datain.netsuiteModel.siteLocations.siteLocationList[1].country.substring(2);
			   user1 = datain.netsuiteModel.siteLocations.siteLocationList[0].numberOfUsers;
			   user2 = datain.netsuiteModel.siteLocations.siteLocationList[1].numberOfUsers;
			   break;
		case 3:
			nlapiLogExecution('DEBUG','case ', '3' );
			   defCountry1 = datain.netsuiteModel.siteLocations.siteLocationList[0].country.substring(2);
			   defCountry2 = datain.netsuiteModel.siteLocations.siteLocationList[1].country.substring(2);
			   defCountry3 = datain.netsuiteModel.siteLocations.siteLocationList[2].country.substring(2);
			   user1 = datain.netsuiteModel.siteLocations.siteLocationList[0].numberOfUsers;
			   user2 = datain.netsuiteModel.siteLocations.siteLocationList[1].numberOfUsers;
			   user3 = datain.netsuiteModel.siteLocations.siteLocationList[2].numberOfUsers;
			   break; 
		}	

		//nlapiLogExecution('DEBUG','get_site_length ', get_site_length ); 
		//nlapiLogExecution('DEBUG','numberOfUsers ',  datain.netsuiteModel.siteLocations.siteLocationList[0].numberOfUsers ); 
		//nlapiLogExecution('DEBUG','devices data', 'user1: ' + user1 + 'user2: ' + user2 + 'user3: ' + user3 );  
	   var defValue = defValue3(datain.netsuiteModel.customerContactInfo.country.substring(2), defCountry1, defCountry2, defCountry3, breakPoints);

		var requestor;
		var resellContact;
		var ciscoContact ;
		var email_reseller = '';
		var email_cisco = '';
		var pointregion = [];
		var devices = [];
		var CTA;

		if(datain.netsuiteModel.technicalInformation.ciscoIntegratedServiceRouter){devices.push('2');}
		if(datain.netsuiteModel.technicalInformation.ciscoAdaptiveSecurityAppliance){devices.push('3');}
		if(datain.netsuiteModel.technicalInformation.ciscoWebSecurityAppliance){devices.push('4');}
		if(datain.netsuiteModel.technicalInformation.ciscoWebSecurityVirtualAppliance){devices.push('5');}
		if(datain.netsuiteModel.technicalInformation.noDevice){devices.push('1');}
		if(datain.netsuiteModel.technicalInformation.other){devices.push('6');}

		if(datain.netsuiteModel.technicalInformation.southAmerica){pointregion.push('1');}
		if(datain.netsuiteModel.technicalInformation.asia){pointregion.push('2');}
		if(datain.netsuiteModel.technicalInformation.southAfrica){pointregion.push('3');}
		if(datain.netsuiteModel.technicalInformation.uae){pointregion.push('4');}
		if(datain.netsuiteModel.technicalInformation.china){pointregion.push('5');}
		if(datain.netsuiteModel.technicalInformation.noneOfAbove){pointregion.push('6');}

		if(datain.netsuiteModel.technicalInformation.advancedMalware){
				CTA = 4;
			} else {
				CTA = 5;				
			}

		//nlapiLogExecution('DEBUG','devices data', JSON.stringify(devices) );
		//nlapiLogExecution('DEBUG','pointregion data', JSON.stringify(pointregion) );


		var users = +user1 + +user2 + +user3;
		//nlapiLogExecution('DEBUG','users ', users );


		switch (datain.netsuiteModel.partners){
		case "Authorized_Distributor":
			resellContact = upsertContact(datain.netsuiteModel.requestorContactInfo.companyName, "", datain.netsuiteModel.requestorContactInfo.firstName, datain.netsuiteModel.requestorContactInfo.lastName, datain.netsuiteModel.requestorContactInfo.phoneNumber, datain.netsuiteModel.requestorContactInfo.role, datain.netsuiteModel.requestorContactInfo.email, "", datain.netsuiteModel.requestorContactInfo.country.substring(0,2), defValue.subsidiary, "6");
			requestor = "3";
			email_reseller = datain.netsuiteModel.requestorContactInfo.email;
	       	 	break;
		case "Sales_Partner":
			ciscoContact = upsertContact("", "197746", datain.netsuiteModel.requestorContactInfo.firstName, datain.netsuiteModel.requestorContactInfo.lastName, datain.netsuiteModel.requestorContactInfo.phoneNumber, datain.netsuiteModel.requestorContactInfo.role, datain.netsuiteModel.requestorContactInfo.email, "", datain.netsuiteModel.requestorContactInfo.country.substring(0,2), "5", "7");
			requestor = "1";
			email_cisco = datain.netsuiteModel.requestorContactInfo.email;
	       		break;
		case "Channel_Partner":
			resellContact = upsertContact(datain.netsuiteModel.requestorContactInfo.companyName, "", datain.netsuiteModel.requestorContactInfo.firstName, datain.netsuiteModel.requestorContactInfo.lastName, datain.netsuiteModel.requestorContactInfo.phoneNumber, datain.netsuiteModel.requestorContactInfo.role, datain.netsuiteModel.requestorContactInfo.email, "", datain.netsuiteModel.requestorContactInfo.country.substring(0,2), defValue.subsidiary, "6");
			requestor = "2";
			email_reseller = datain.netsuiteModel.requestorContactInfo.email;
	       	 	break;  	
		}

		//nlapiLogExecution('DEBUG','requestor ', requestor );

       var resellNo = nlapiLookupField('partner', defValue.partner, 'custentity_partner_resellerid');
       nlapiSubmitField('customrecord_salesorder_integration', evalId, ['custrecord_completed', 'custrecord_partner_resellerid'], ['1', resellNo]);

 	   var customer = createCustomer(defValue.partner, defValue.subsidiary, datain.netsuiteModel.customerContactInfo.company, requestor, datain.netsuiteModel.customerContactInfo.totalNumber, datain.netsuiteModel.customerContactInfo.estimatedNumber, datain.netsuiteModel.customerContactInfo.streetAddress, datain.netsuiteModel.customerContactInfo.city, datain.netsuiteModel.customerContactInfo.stateCountry, datain.netsuiteModel.customerContactInfo.zipCode, datain.netsuiteModel.customerContactInfo.country.substring(0,2)) ;

 	  nlapiSubmitField('customrecord_salesorder_integration', evalId, ['custrecord_completed', 'custrecord_eval_entity'], ['2', customer]);

 	   var evalContact = upsertContact("", customer, datain.netsuiteModel.customerContactInfo.primaryFirstName, datain.netsuiteModel.customerContactInfo.primaryLastName, datain.netsuiteModel.customerContactInfo.phoneNumber, datain.netsuiteModel.customerContactInfo.titleRole, datain.netsuiteModel.customerContactInfo.email, "", datain.netsuiteModel.customerContactInfo.country.substring(0,2), defValue.subsidiary, "-10"); 

  	  nlapiSubmitField('customrecord_salesorder_integration', evalId, 'custrecord_completed', '3');

	   var salesorder = createSalesOrder(customer, defValue.partner, users, nlapiDateToString(new Date(),'date'), datain.netsuiteModel.customerContactInfo.primaryFirstName, datain.netsuiteModel.customerContactInfo.primaryLastName, datain.netsuiteModel.customerContactInfo.email, email_reseller, email_cisco, ss_item, +datain.netsuiteModel.technicalInformation.advancedMalware + 3, ss_logext, datain.netsuiteModel.customerContactInfo.phoneNumber, pointregion, devices, datain.netsuiteModel.siteLocations.saas_visility);


nlapiSubmitField('salesorder', salesorder, ['custbody_pp_company_email_address'], [datain.netsuiteModel.customerContactInfo.email]);
	   nlapiSubmitField('customrecord_salesorder_integration', evalId, ['custrecord_completed', 'custrecord_eval_sales_order'], ['4', salesorder]);
	   
	   CreateDeploymentCustomRecord(salesorder);

	   nlapiSubmitField('customrecord_salesorder_integration', evalId, 'custrecord_completed', '5');

		if (!Is_Empty(resellContact)) {nlapiAttachRecord('contact',resellContact.contactId, 'salesorder', salesorder, {'role' : '6'});}
		if (!Is_Empty(ciscoContact)) {nlapiAttachRecord('contact',ciscoContact.contactId,'salesorder',salesorder, {'role' : '7'});}				
		if (!Is_Empty(evalContact)) {nlapiAttachRecord('contact',evalContact.contactId,'salesorder',salesorder, {'role' : '-10'});}

	   var site1 = createSiteGrid(salesorder, datain.netsuiteModel.siteLocations.siteLocationList[0].numberOfUsers, datain.netsuiteModel.siteLocations.siteLocationList[0].country.substring(2), datain.netsuiteModel.siteLocations.siteLocationList[0].state.substring(2), '', defValue.partner);
     
       if (get_site_length == 2) {
         var site2 = createSiteGrid(salesorder, datain.netsuiteModel.siteLocations.siteLocationList[1].numberOfUsers, datain.netsuiteModel.siteLocations.siteLocationList[1].country.substring(2), datain.netsuiteModel.siteLocations.siteLocationList[1].state.substring(2), '', defValue.partner);
       }
       
       if (get_site_length == 3) {
         var site2 = createSiteGrid(salesorder, datain.netsuiteModel.siteLocations.siteLocationList[1].numberOfUsers, datain.netsuiteModel.siteLocations.siteLocationList[1].country.substring(2), datain.netsuiteModel.siteLocations.siteLocationList[1].state.substring(2), '', defValue.partner);     
         var site3 = createSiteGrid(salesorder, datain.netsuiteModel.siteLocations.siteLocationList[2].numberOfUsers, datain.netsuiteModel.siteLocations.siteLocationList[2].country.substring(2), datain.netsuiteModel.siteLocations.siteLocationList[2].state.substring(2), '', defValue.partner);	 
       }
       
	   nlapiSubmitField('customrecord_salesorder_integration', evalId, 'custrecord_completed', '9');

	   var dCapture = dataCapture(salesorder, (Is_Empty(resellContact))?'':resellContact.contactId, (Is_Empty(ciscoContact))?'' : ciscoContact.contactId, (Is_Empty(evalContact))?'' : evalContact.contactId, datain.netsuiteModel.customerContactInfo.primaryFirstName,	datain.netsuiteModel.customerContactInfo.primaryLastName, datain.netsuiteModel.customerContactInfo.email, datain.netsuiteModel.technicalInformation.otherField, breakPoints , CTA,	datain.netsuiteModel.siteLocations.additionalInformation,	devices, pointregion, '2');	   

	   return salesorder;   
   	}  


  }
  catch (e){
      var text = {"customrecord_sg_site.custrecord_sg_state.1":"","customrecord_data_capture.custrecord_cta_amp_option":"4","custpage_next_page":"2","customrecord_sg_site.custrecord_sg_number_of_seats.2":"10","compid":"772356","customrecord_sg_site.custrecord_sg_state.3":"","customrecord_sg_site.custrecord_sg_number_of_seats.1":"100","customrecord_sg_site.custrecord_sg_state.2":"","customrecord_sg_site.custrecord_sg_number_of_seats.3":"10","deploy":"1","customrecord_sg_site.custrecord_sg_country.1":"1","script":"160","customrecord_sg_site.custrecord_sg_country.2":"154","customrecord_sg_site.custrecord_sg_country.3":"153","customrecord_data_capture.custrecord_dc_cisco_devices.2":"2","h":"6ff8579d92bea75271af","customrecord_data_capture.custrecord_dc_breakout_points":"1","customrecord_data_capture.custrecord_dc_breakout_point_regions.1":"7"};

      nlapiLogExecution('ERROR', 'Bad POST Data ', JSON.stringify(e));	
      new email(nlapiGetContext(), nlapiGetRecordType(), nlapiGetRecordId(),  e, JSON.stringify(datain)).send_error_email();

      var evalRecord = nlapiCreateRecord('customrecord_eval_rest_request');
      var evalId;
      
      if (!Is_Empty(datain.netsuiteModel)){
    	  evalId = datain.netsuiteModel.evalRequestId;
      } else if (!Is_Empty(datain.evalRequestId)){
    	  evalId = datain.evalRequestId;
      }
      
      if (evalId){
    	  evalRecord.setFieldValue('custrecord_so_integration', evalId);	
    	  
    	  //Puts error on Sales Order Integration Record
		  var record = nlapiLoadRecord('customrecord_salesorder_integration', evalId);
		  record.setFieldValue('custrecord_eval_error', JSON.stringify(e));
		  nlapiSubmitRecord(record,true,true); 
      }
      
      //Puts error in custom log, some errors will not be associated to an evalId
      evalRecord.setFieldValue('custrecord_instant_eval_json', JSON.stringify(e));
      nlapiSubmitRecord(evalRecord,true,true);
      
  }

}

function Is_Empty(stValue)
{
    if ((stValue == '') || (stValue == null) || (stValue == undefined)) 
    {
        return true;
    }
    return false;
}

// Create a standard NetSuite record
/*

{
       “createStatus”: true
}


{
  "netsuiteModel": {
    "evalRequestId" : “1066”,    <- THIS VALUE COMES FROM FIRST POST CALL
    "partners": "Authorized_Distributor",
    "requestorContactInfo": {
      "companyName": "Authorized_Distributor_Name",
      "country": "US108",
      "firstName": "Requestor First Name",
      "lastName": "Requestor Last Name",
      "role": "Requestor role",
      "phoneNumber": "2345678",
      "email": "gg@dsa.da"
    },
    "customerContactInfo": {
      "company": "Customer Company",
      "streetAddress": "Customer Street Address",
      "city": "Customer City",
      "country": "US108",
      "stateCountry": "US11",
      "zipCode": "23456",
      "primaryFirstName": "Customer Primary First name",
      "primaryLastName": "Customer Primary Last name",
      "titleRole": "Customer Primary Role",
      "phoneNumber": "2345678",
      "email": "notval4id@mail.com",
      "totalNumber": "3",
      "estimatedNumber": "2",
      "timeZone": "GMT+1:00"
    },
    "technicalInformation": {
      "ciscoIntegratedServiceRouter": true,
      "ciscoAdaptiveSecurityAppliance": false,
      "ciscoWebSecurityAppliance": false,
      "ciscoWebSecurityVirtualAppliance": false,
      "noDevice": false,
      "other": false,
      "otherField": "",
      "advancedMalware": true,
      "multipleCountries": true,
      "southAmerica": true,
      "asia": true,
      "southAfrica": true,
      "uae": true,
      "china": true,
      "noneOfAbove": false
    },
    "siteLocations": {
      "siteLocationList": [
        {
          "country": "US108",
          "state": "US3",
          "numberOfUsers": 30
        },
        {
          "country": "US108",
          "state": "US7",
          "numberOfUsers": 20
        },
        {
          "country": "GB107",
          "state": "GB280",
          "numberOfUsers": 20
        }
      ],
      "additionalInformation": "info"
    }
  }
}

{
  "companyId": "CWS_Company_ID",
  "activationUrl": " https://scancenter.com/activate?code= b8422655-2d6b-23213",
  "evalRequestId": "1066”
}



*/