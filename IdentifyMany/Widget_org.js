define(['dojo/_base/declare', 
        'dojo/Deferred',
        'dojo/_base/lang',
        'dojo/dom-construct',  //http://dojotoolkit.org/reference-guide/1.10/dojo/dom-construct.html
        'dojo/on',
        'esri/geometry/scaleUtils',
        'esri/tasks/BufferParameters',
        'esri/tasks/query',
        'esri/tasks/QueryTask',
        'esri/tasks/IdentifyTask',
        'esri/tasks/IdentifyParameters',        
        'esri/geometry/Geometry',
        'esri/tasks/GeometryService',
        'esri/geometry/webMercatorUtils',
        'esri/symbols/SimpleFillSymbol',
        'esri/symbols/SimpleLineSymbol',
        'esri/symbols/SimpleMarkerSymbol',
        'esri/Color',
        'jimu/dijit/TabContainer',
        'dijit/TitlePane',
        'dijit/_WidgetsInTemplateMixin',  //need for mixing dojo elements like titlepane
        'jimu/BaseWidget'],
function(declare,
         Deferred,
         lang, domConstruct, on,
         scaleUtils,
         BufferParameters, Query, QueryTask, IdentifyTask, IdentifyParameters, Geometry, GeometryService, webMercatorUtils,
         SimpleFillSymbol, SimpleLineSymbol, SimpleMarkerSymbol, Color,
         TabContainer,
         TitlePane,
         _WidgetsInTemplateMixin,
         BaseWidget) {

  return declare([BaseWidget, _WidgetsInTemplateMixin], {
    tabContainer: null,
    baseClass: 'jimu-widget-identifyMany',  //name
    mapClick: null,

    postCreate: function() {
      this.inherited(arguments);
      this._initTabContainer();  //create tabs in panel

      //Proxy page for large buffers (post)
      //esri.config.defaults.io.proxyUrl = "./proxy/proxy.ashx";
      esri.config.defaults.io.proxyUrl = "/website/DART/StaffMap/proxy/proxy.ashx";
      esri.config.defaults.io.alwaysUseProxy = false;

      //Highlight geometry variables
      highlightResults_Storm = [];  //object to hold feature boundaries for highlighting - Storm data
      highlightResults_Sewer= [];  //object to hold feature boundaries for highlighting - Sewer data
      highlightResults = [];  //object to hold feature boundaries for highlighting - all other data

      //Field check variables
      shapeField1 = new RegExp("Shape");  //format string for all shape fields check with test function
      shapeField2 = new RegExp("SHAPE");  //format string for all shape fields check with test function
      linkValue = new RegExp("http");   //format string for link values to check with test function

            // IMPORTANT!!!!!!! - Map IDENTIFY Type: public vs staff (how to determine what is visible)
            //var publicMap =  false;    //staff map
            //var publicMap =  true;    //public map
            publicMap =  true;    //public map

            if (publicMap) {         //check if public map
               var webserver1 = "gis.cityoftacoma.org/arcgis";
               var webserver2 = "gis.cityoftacoma.org/arcgis";
               var folder1 = "PDS";
            } else {       //staff map
               var webserver1 = "arcgisprod01";
               var webserver2 = "geobase-dbnewer";
               var folder1 = "DART";
            } 

        //---Global variables
              //Current Map properties
              myMapWidth  = this.map.width;
              myMapHeight = this.map.height;
              myMapSR = this.map.spatialReference;

              //Highlight graphic symbols
              symbol_Highlight = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID, SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([0,0,255]), 2), new Color([255,255,0,0.25]));
              symbol_Highlight_Pt = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_SQUARE, 14,
                                    new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
                                    new Color([0,0,255]), 1),
                                    new Color([0,0,255,0.25]));

              //Point-to-inside-buffer-parcel functions within pointToExtent 
              queryTaskParcelGeometry = new QueryTask("https://" + webserver1 + "/rest/services/" + folder1 + "/DARTparcels_PUBLIC/MapServer/3");     //Base Parcel - don't use condo boundaries
              queryParcelGeometry = new Query();
              queryParcelGeometry.outFields = ["TaxParcelNumber"];  //to use for querying buildings
              queryParcelGeometry.returnGeometry = true;
              queryParcelGeometry.outSpatialReference = myMapSR;
              //--end Setup for parcel geometry query

              //Query buildings setup
              queryBuildingTask = new QueryTask("https://" + webserver1 + "/rest/services/" + folder1 + "/DARTquery_WAB_PUBLIC/MapServer/22");  //AssessorImprovement table
              queryBuilding = new Query();
              queryBuilding.returnGeometry = false; 
              //Must use the actual field names rather than the alias names, but can use the alias names later when you display the results.
              queryBuilding.outFields = ["BUILDINGID","PARCELNUMBER", "PROPERTYTYPE","PRIMARYOCCUPANCYDESCRIPTION","SQUAREFEET","NETSQUAREFEET"];
              queryBuilding.orderByFields = ["BUILDINGID"];
             //End query buildings setup

              if (!publicMap) {
	              //Wetland document query setup
	              queryTaskWetlandDoc = new QueryTask("https://" + webserver1 + "/arcgis/rest/services/Test/WetlandTest/MapServer/1");
	              queryWetlandDoc = new Query();
	              queryWetlandDoc.returnGeometry = false;
	              queryWetlandDoc.outFields = ["Document_ID","File_Number","Address","Wetland_PolygonID", "Notes"];
	              wetlandDocDiv = this.wetland_details;  //div location to put results, work around for functions getting out-of-scope (can't find this)
          	  }

              //Buffer parcel setup
              //---Geometry Service - may need proxy for larger polys - see add data widget
              gsvc = new GeometryService("https://" + webserver1 + "/rest/services/Utilities/Geometry/GeometryServer");
              paramsBuffer = new BufferParameters();  
              paramsBuffer.distances = [ -2 ];  //inside buffer   - fix for narrow parcels like 5003642450
              paramsBuffer.bufferSpatialReference = new esri.SpatialReference({wkid: 102100});
              paramsBuffer.outSpatialReference = myMapSR;
              paramsBuffer.unit = esri.tasks.GeometryService["UNIT_FOOT"];
              //---end Geometry Service - for buffer

              //Identify parameters for current map state
              //Web services for identify
              identifyTask = new IdentifyTask("https://" + webserver1 + "/rest/services/" + folder1 + "/DARTquery_WAB_PUBLIC/MapServer");  //All other layers - processed with _processIdentifyResults
              identifyParams = new IdentifyParameters();
              identifyParams.returnGeometry = true;
              identifyParams.layerIds = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21];  //layers to query for identify popup (query layers)
              //identifyParams.layerIds = ['*'];  //Query all layers for identify popup (query layers) - Non-spatial Improvement table (22) causes problem
              identifyParams.layerOption = IdentifyParameters.LAYER_OPTION_VISIBLE;  //identify just visible layers - based on min/max scale
              identifyParams.width  = myMapWidth;
              identifyParams.height = myMapHeight;
              identifyParams.spatialReference = myMapSR;
              identifyParams.tolerance = 3;
              //---end Identify parameters

              //Identify Soil Contamination - Predicted Arsenic Levels 
              identifyTaskArsenic = new IdentifyTask("https://fortress.wa.gov/ecy/ecyprodgislb/arcgis/rest/services/TCP/SmelterSearch/MapServer");  //smelter plume
              identifyParamsArsenic = new IdentifyParameters();
              identifyParamsArsenic.returnGeometry = false;
              identifyParamsArsenic.layerIds = [3];  //layers to query - Tacoma Smelter Plume Footprint
              identifyParamsArsenic.layerOption = IdentifyParameters.LAYER_OPTION_VISIBLE;  //identify just visible layers
              identifyParamsArsenic.width  = myMapWidth;
              identifyParamsArsenic.height = myMapHeight;
              identifyParamsArsenic.spatialReference = myMapSR;
              identifyParamsArsenic.tolerance = 3;
              arsenicDiv = this.arsenic_details;  //div location to put results, work around for functions getting out-of-scope (can't find 'this')
              // end identify Soil

              //Identify Storm (SurfacewaterNetwork) 
              identifyTaskStorm = new IdentifyTask("https://gis.cityoftacoma.org/arcgis/rest/services/PDS/DARTsewer/MapServer");  //storm
              identifyParamsStorm = new IdentifyParameters();
              identifyParamsStorm.returnGeometry = true;  //need for highlighting
              identifyParamsStorm.layerIds = [0,1,2,3];  //layer folders to query (All) - Use bullet folder numbers when subfolders are used (not layer numbers)
              identifyParamsStorm.layerOption = IdentifyParameters.LAYER_OPTION_VISIBLE;  //identify just visible layers - based on min/max scale
              identifyParamsStorm.width  = myMapWidth;
              identifyParamsStorm.height = myMapHeight;
              identifyParamsStorm.spatialReference = myMapSR;
              identifyParamsStorm.tolerance = 3;
              StormDiv = this.storm_details;  //div location to put results, work around for functions getting out-of-scope (can't find this)
              // end identify Storm

              //Identify Sewer (WastewaterNetwork) 
              identifyTaskSewer = new IdentifyTask("https://gis.cityoftacoma.org/arcgis/rest/services/PDS/DARTsewer/MapServer");  //sewer
              identifyParamsSewer = new IdentifyParameters();
              identifyParamsSewer.returnGeometry = true;  //need for highlighting
              identifyParamsSewer.layerIds = [4,5,6,7];  //layer folders to query (All) - Use bullet folder numbers when subfolders are used (not layer numbers)
              identifyParamsSewer.layerOption = IdentifyParameters.LAYER_OPTION_VISIBLE;  //identify just visible layers
              identifyParamsSewer.width  = myMapWidth;
              identifyParamsSewer.height = myMapHeight;
              identifyParamsSewer.spatialReference = myMapSR;
              identifyParamsSewer.tolerance = 3;
              SewerDiv = this.sewer_details;  //div location to put results, work around for functions getting out-of-scope (can't find this)
              // end identify Sewer


        //---end  add global variables for point-to-inside-buffer-parcel function 
    },

    startup: function() {
      this.inherited(arguments);

    },

      _initTabContainer: function () {
        //create the identify tabs within the widget panel - General, Green, Urban, LandUse, Region
        var tabs = [];
        
        tabs.push({
          title: this.nls.tab1label,
          content: this.tabNode1
        });
        tabs.push({
          title: this.nls.tab2label,
          content: this.tabNode2
        });
        tabs.push({
          title: this.nls.tab3label,
          content: this.tabNode3
        });
        tabs.push({
          title: this.nls.tab4label,
          content: this.tabNode4
        });
        tabs.push({
          title: this.nls.tab5label,
          content: this.tabNode5
        });

        this.selTab = this.nls.tab1label; //selected tab

        //create tabs
        this.tabContainer = new TabContainer({
          tabs: tabs,
          selected: this.selTab
        }, this.tabIdentify);

        this.tabContainer.startup();
      },

      _removeGraphic: function(graphicID){
        dojo.forEach(this.map.graphics.graphics, function(g){
            if (g && g.id === graphicID) {
              this.map.graphics.remove(g); //remove graphic with specific id
            }
          }, this);
      },

      _tabSummaries: function(infoTitle, sum_text, divTitle) {
        //Collapsible bar to hold layer summary details (TitlePane) - http://dojotoolkit.org/reference-guide/1.10/dijit/TitlePane.html
        //Create only if layers were found
        if (sum_text.length>0) {
          if (infoTitle.indexOf('Parcel Details') !== -1) {
            var infoAll = new TitlePane({title: infoTitle, open: true, content: sum_text});  //expand 'Parcel Details' group
          } else {
            var infoAll = new TitlePane({title: infoTitle, open: false, content: sum_text});  //close all other groups
          }

          divTitle.appendChild(infoAll.domNode);  //update parcel_details DIV content
          domConstruct.place("<br>",  divTitle, "first");    //add space before collapsible bar - http://dojotoolkit.org/reference-guide/1.7/dojo/place.html
        }
      },

      _showFeature: function(featureNum, type) {
        //highlights data item on map
        this._removeGraphic('identify');  //clear any identify graphic
        //check for which list of highlight objects: storm (highlightResults_Storm), sewer, or all the rest (highlightResults)
        if (type == 'Storm') {
          var feature = highlightResults_Storm[featureNum];  //object to hold feature boundaries for highlighting
        } else if (type == 'Sewer') {
          var feature = highlightResults_Sewer[featureNum];  //object to hold feature boundaries for highlighting
        } else {
          var feature = highlightResults[featureNum];  //object to hold feature boundaries for highlighting
        }

        //check if feature a point or other type
        if (feature.geometry.type=="point"){
          feature.setSymbol(symbol_Highlight_Pt); //use marker symbol
         } else {
          feature.setSymbol(symbol_Highlight); //use default symbol
         }
              
        feature.geometry.spatialReference = myMapSR;  //Set feature's spatial reference so selected layer highlighted correctly
        feature.id = "identify";  //add id for later removal by id
        this.map.graphics.add(feature);  //add graphic to map
      },

      _numberWithCommas: function(x) {
          //check for null values
          if (x) {
              return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
          } else {
              return 0;
          }
      },

      _showWetlandDocs: function(results) {
        //if wetland id is null/empty this function won't be run (field skipped in _processIdentifyResults)
        var wetlandText = "<b><br>Wetland Permit Document</b>";  //start wetland document text
        for (var i = 0; i < results.features.length; i++) {
          //loop through documents
          var featureAttributes = results.features[i].attributes;
          for (var attr in featureAttributes) {
            //loop through fields
            //simplify this part once final relate table is in SQL Server
            if (attr=="Document_ID") {
                wetlandText += "<br>&nbsp;&nbsp;<a href='http://cedd031d/WetlandPermits/" + featureAttributes[attr] + ".pdf'  title='Open document' target='_blank'>Link</a>&nbsp;&nbsp;|&nbsp;&nbsp;";
            } else if (String(featureAttributes[attr])!="null"){
                if (attr=="File_Number") {
                  wetlandText += "File:  <i>" + String(featureAttributes[attr]) + "</i>";
                } else if (attr=="Wetland_PolygonID") {
                  //don't show wetland id - for now (if permanent remove from list of field retrieved)
                  //wetlandText += "<b>Wetland:</b>  " + String(featureAttributes[attr]) + "&nbsp;&nbsp;";
                } else {
                  wetlandText += " | " + attr + ":  <i>" + String(featureAttributes[attr]) + "</i>";
                }
            }
          }
        }
        domConstruct.place(wetlandText, wetlandDocDiv);  //put text inside wetland_details DIV
      },

      _showWetlandDocsError: function(err) {
        alert("Error retrieving wetland documents: " + err.message);
        console.error("WetlandDocs Error: ", err.message);  //error handling
      },

      _processQueryResults: function(results){
        var theFormattedResults = "";  //default result text
        var theFormattedTitle = "Building Summary";  //default title bar text
            if (results.features.length>1) {
              theFormattedTitle += ", " + results.features.length + " buildings on parcel";
            }
        var theFieldAliases = [];  //create a list of the field aliases (step needed for Query Tasks - results formatted differently from identify)
        for (fieldName in results.fieldAliases) { 
          theFieldAliases.push(results.fieldAliases[fieldName]);  //add each alias to the list
        }

        for (var i = 0; i < results.features.length; i++) {   //Loop through each building
          var idx = 0;  //add field index counter 

          for (fieldName in results.features[i].attributes) {  //Loop through each field
            if (idx != 1) {  //skip PARCELNUMBER field
              if (idx == 4 || idx == 5) {  //format number fields
                theFormattedResults += "&nbsp;&nbsp;" + theFieldAliases[idx] + ": <i>" + this._numberWithCommas(results.features[i].attributes[fieldName]) + "</i><br>";
              } else {
                theFormattedResults += "&nbsp;&nbsp;" + theFieldAliases[idx] + ": <i>" + results.features[i].attributes[fieldName] + "</i><br>";
              }
            }
            
            idx++; //add 1 to field index counter
          }
          theFormattedResults += "<br>";  //space between individual buildings
        }

        //Update tab summaries (collapsible) - title, text details, div id
        this._tabSummaries(theFormattedTitle, theFormattedResults, this.building_details);

      },

      _formatLines: function(number, fieldName, fieldValue){
        var formatLines = "";  //default result text
        if (number == 1) {
          //one line
          if (fieldName == 'ADDRESSID') {
            //Old Permit/Site History page (3/22/2018)
            //formatLines = "&nbsp;&nbsp;<a href=\"http://govme.org/govME/Permits/Inter/PermitSiteHistory/Insp_Card_List.aspx?Param=MG&AddressID=" + fieldValue  + "\" target=\"_blank\">E-Vault Document(s)</a><br>&nbsp;<br>";
          } else {
            formatLines += "&nbsp;&nbsp;" + fieldName + ": <i>" + fieldValue + "</i> &nbsp;&nbsp;";
          }
        } else {
          //many lines
          formatLines += "&nbsp;&nbsp;" + fieldName + ": <i>" + fieldValue + "</i><br>";
        }
        return formatLines;
      },

      _processIdentifyResultsStorm: function(results){
        var theFormattedResults = "";  //default result text
        var layerIndex = 0;  //fix for excluding layers and keeping track of layer index number
        var highlightIDs_Storm = [];  //object to hold create dom locations to run highlight boundary function for each layer
        highlightResults_Storm = [];  //object to hold feature boundaries (geometry) for highlighting - empty out

        for (var i = 0; i < results.length; i++) {  //Loop through each layer (i)
         if (results[i].layerName !== 'Flow Direction') {  //Skip 'Flow Direction' layers - duplicate of main layers
            theFormattedResults += "<b><br>" + results[i].layerName + "</b><br>";  //New layer name
            
            //Calculate Manhole Depth and put as first value - ignore if fields missing, null, or empty
            if (results[i].layerName == 'Surfacewater Manhole' && results[i].feature.attributes['RIMELEV'] != undefined && results[i].feature.attributes['RIMELEV'] != 'Null' && results[i].feature.attributes['RIMELEV'] != ' ' && results[i].feature.attributes['SUMPELEV'] != undefined && results[i].feature.attributes['SUMPELEV'] != 'Null' && results[i].feature.attributes['SUMPELEV'] != ' '){  
              theFormattedResults += '&nbsp;&nbsp;Manhole Depth: <i>' + (results[i].feature.attributes['RIMELEV'] - results[i].feature.attributes['SUMPELEV']).toFixed(2) + "</i><br>"; 
            }  
             
            var idx = 0;  //add index counter to check for first viable field for highlighting 
            for (fieldName in results[i].feature.attributes) {  //Loop through the properties (fields - attributes) of an object (layer - feature)
                //Skip fields with null/blank values; Fields to exclude: OBJECTID, ENTITYID, FID, shape*
                if (results[i].feature.attributes[fieldName] !== 'Null' && results[i].feature.attributes[fieldName] !== ' ' && fieldName !== 'OBJECTID' && fieldName !== 'ENTITYID' && fieldName !== 'FID' && !shapeField1.test(fieldName) && !shapeField2.test(fieldName)) {
                  if (linkValue.test(results[i].feature.attributes[fieldName])) {  //HYPERLINK field (don't set as first field for layer - ASSUME first field to be used for geometry hightlight!!!!!)
                    theFormattedResults += "&nbsp;&nbsp;<a href='" + results[i].feature.attributes[fieldName] + "' target='_blank' title='View document'>" + fieldName + "</a><br>";
                  } else {  //Non-HYPERLINK fields
                    if (idx==0) {  //HIGHLIGHT boundary for first available field - use layerIndex to sync; Format text with placeholder for highlight function and variable - use a dynamic id value
                         theFormattedResults += "&nbsp;&nbsp;" + fieldName + ": <span id='HighlightStorm" + layerIndex + "'></span><br>";
                          //Add geometry info to array for link update later - use layerIndex to sync
                          highlightIDs_Storm.push(results[layerIndex].feature.attributes[fieldName]); //update each layer highlight field name - use later to place Highlight function
                          highlightResults_Storm.push(results[layerIndex].feature); //update with results from each layer - contains geometry for highlighting
                    } else {  //Non-highlight fields
                          theFormattedResults += this._formatLines(2, fieldName, results[i].feature.attributes[fieldName]);
                    }
                  } //end hyperlink check
                  idx++; //add 1 to field index counter
                }  //first check of field types
             }  //end loop through layer fields
            layerIndex++; //add 1 to layer index counter
          } //flow direction layer check
         }  //end loop through layers

        //Update tab div text
        this._tabSummaries('Storm', theFormattedResults, this.storm_details);

        //Update fields within tabs the highlight function
        for (var i = 0; i < highlightIDs_Storm.length; i++) {
          //Add dynamic highlight function to formatted text
          var list = dojo.byId("HighlightStorm"+i);
          domConstruct.create("span", {innerHTML: "<i><span style='color: blue; cursor: pointer;' title='Highlight boundary'>" + highlightIDs_Storm[i] + "</span></i>"}, list);
          //Method to add click event  - Need this.own to maintain scope of dynamic text function within the popup; lang.hitch to keep scope of function within widget
          this.own(on(list, 'click', lang.hitch(this, this._showFeature, i, 'Storm')));  //this.own(on(Node, 'click', lang.hitch(this, FUNCTION, param1, param2, etc)));
        }

      },  

      _processIdentifyResultsSewer: function(results){
        var theFormattedResults = "";  //default result text
        var layerIndex = 0;  //fix for excluding layers and keeping track of layer index number
        var highlightIDs_Sewer = [];  //object to hold create dom locations to run highlight boundary function for each layer
        highlightResults_Sewer = [];  //object to hold feature boundaries (geometry) for highlighting - empty out

        for (var i = 0; i < results.length; i++) {  //Loop through each layer (i)
         if (results[i].layerName !== 'Flow Direction') {  //Skip 'Flow Direction' layers - duplicate of main layers
            theFormattedResults += "<b><br>" + results[i].layerName + "</b><br>";  //New layer name
 
            //Calculate Manhole Depth and put as first value - ignore if fields missing, null, or empty
            if (results[i].layerName == 'Wastewater Manhole' && results[i].feature.attributes['RIMELEV'] != undefined && results[i].feature.attributes['RIMELEV'] != 'Null' && results[i].feature.attributes['RIMELEV'] != ' ' && results[i].feature.attributes['SUMPELEV'] != undefined && results[i].feature.attributes['SUMPELEV'] != 'Null' && results[i].feature.attributes['SUMPELEV'] != ' '){  
              theFormattedResults += '&nbsp;&nbsp;Manhole Depth: <i>' + (results[i].feature.attributes['RIMELEV'] - results[i].feature.attributes['SUMPELEV']).toFixed(2) + "</i><br>"; 
            }  

            var idx = 0;  //add index counter to check for first viable field for highlighting 
            for (fieldName in results[i].feature.attributes) {  //Loop through the properties (fields - attributes) of an object (layer - feature)
                //Skip fields with null/blank values; Fields to exclude: OBJECTID, ENTITYID, FID, shape*
                if (results[i].feature.attributes[fieldName] !== 'Null' && results[i].feature.attributes[fieldName] !== ' ' && fieldName !== 'OBJECTID' && fieldName !== 'ENTITYID' && fieldName !== 'FID' && !shapeField1.test(fieldName) && !shapeField2.test(fieldName)) {
                  if (linkValue.test(results[i].feature.attributes[fieldName])) {  //HYPERLINK field (don't set as first field for layer - ASSUME first field to be used for geometry hightlight!!!!!)
                    theFormattedResults += "&nbsp;&nbsp;<a href='" + results[i].feature.attributes[fieldName] + "' target='_blank' title='View document'>" + fieldName + "</a><br>";
                  } else {  //Non-HYPERLINK fields
                    if (idx==0) {  //HIGHLIGHT boundary for first available field - use layerIndex to sync; Format text with placeholder for highlight function and variable - use a dynamic id value
                         theFormattedResults += "&nbsp;&nbsp;" + fieldName + ": <span id='HighlightSewer" + layerIndex + "'></span><br>";
                          //Add geometry info to array for link update later - use layerIndex to sync
                          highlightIDs_Sewer.push(results[layerIndex].feature.attributes[fieldName]); //update each layer highlight field name - use later to place Highlight function
                          highlightResults_Sewer.push(results[layerIndex].feature); //update with results from each layer - contains geometry for highlighting
                    } else {  //Non-highlight fields
                          theFormattedResults += this._formatLines(2, fieldName, results[i].feature.attributes[fieldName]);
                    }
                  } //end hyperlink check
                  idx++; //add 1 to field index counter
                }  //first check of field types
             }  //end loop through layer fields
            layerIndex++; //add 1 to layer index counter
          } //flow direction layer check
         }  //end loop through layers

        //Update tab div text
        this._tabSummaries('Sewer', theFormattedResults, this.sewer_details);

        //Update fields within tabs the highlight function
        for (var i = 0; i < highlightIDs_Sewer.length; i++) {
          //Add dynamic highlight function to formatted text
          var list = dojo.byId("HighlightSewer"+i);
          domConstruct.create("span", {innerHTML: "<i><span style='color: blue; cursor: pointer;' title='Highlight boundary'>" + highlightIDs_Sewer[i] + "</span></i>"}, list);
          //Method to add click event  - Need this.own to maintain scope of dynamic text function within the popup; lang.hitch to keep scope of function within widget
          this.own(on(list, 'click', lang.hitch(this, this._showFeature, i, 'Sewer')));  //this.own(on(Node, 'click', lang.hitch(this, FUNCTION, param1, param2, etc)));
        }

      },  
      _processIdentifyResults: function(results){
        //Summaries: Parcel, buildings, permits, historic status, wetlands
        //Special formatting: Photo links, legal docs, wind, arsenic links, zoning links, numbers, wetland docs
        var theFormattedResults = "";  //default result text
        var parcel_title = "";  //default parcel collapsible bar text
        var parcel_text = "";  //default parcel text
        var permit_text = "";  //default parcel text
        var legal_text = "";  //default legal documents text
        var historic_text = "";  //default historic status text
        var tab2_text = "";
        var tab4_text = "";
        var tab5_text = "";
        var nothing_text = "Nothing Found";  //default tab text
        highlightResults = [];  //object to hold feature boundaries for highlighting - empty out
        var highlightIDs = [];  //object to hold create dom locations to run highlight boundary function for each layer
        var previousLayerName = "";  //Check for multiple values for the same layer (multiple zonings, etc)

        //Use current map click geometry for Bing & Google links
        var linkLatLong = "&bull; &nbsp;<a href=\"https://www.bing.com/maps/?v=2&cp=" + mapClick.y  + "~" + mapClick.x +"&lvl=19&sty=b\" target=\"_blank\">" ;
        linkLatLong += "Bird\'s Eye Photo (Microsoft Bing)</a>";
        linkLatLong += "<br>&bull; &nbsp;<a href=\"https://wspdsmap.cityoftacoma.org/website/BLUS/StreetView.htm?lat=" + mapClick.y  + "&lon=" + mapClick.x +"\" target=\"_blank\">" ;
        linkLatLong += "Street View Photo (Google Maps)</a>";

        //Loop through each layer (i) within parcel (may have multiple records for same layer - multiple zonings)
        for (var i = 0; i < results.length; i++) {
          //Check for previous field name here (takes care of multiple records for same layer)
          if (previousLayerName != results[i].layerName) {
            //Don't need layer name for items w/i collapsible panels (layer name will apear on panel bar)
            if (results[i].layerId != 0 && results[i].layerId != 1) {
              theFormattedResults += "<b><br>" + results[i].layerName + "</b><br>";  //New layer name
            }
          }  

            //Loop through the properties (fields - attributes) of an object (layer - feature) - http://www.w3schools.com/js/js_loop_for.asp
            var idx = 0;  //add index counter to check for first viable field for highlighting 
            for (fieldName in results[i].feature.attributes) {
                //Skip fields with null/blank values; Fields to exclude: OBJECTID, ENTITYID, FID, shape*
                if (results[i].feature.attributes[fieldName] !== 'Null' && results[i].feature.attributes[fieldName] !== ' ' && fieldName !== 'OBJECTID' && fieldName !== 'ENTITYID' && fieldName !== 'FID' && !shapeField1.test(fieldName) && !shapeField2.test(fieldName)) {
                  if (linkValue.test(results[i].feature.attributes[fieldName])) {
                    //HYPERLINK field (don't set as first field for layer - ASSUME first field to be used for geometry hightlight!!!!!)
                    theFormattedResults += "&nbsp;&nbsp;<a href='" + results[i].feature.attributes[fieldName] + "' target='_blank' title='View document'>" + fieldName + "</a><br>";
                  } else {
                    //Non-HYPERLINK fields
                    if (idx==0) {
                      //HIGHLIGHT boundary for first available field
                      //Add zoning links (before first zoning) 
                      if (fieldName == 'Zoning District' && previousLayerName != results[i].layerName) {
                        theFormattedResults += "&nbsp;&nbsp;<a href=\"http://cms.cityoftacoma.org/Planning/Zoning%20Reference%20Guide%202016.pdf\"  target=\"_blank\" title=\"Zoning Descriptions\">Zoning Descriptions</a><br>";
                        theFormattedResults += "&nbsp;&nbsp;<a href=\"http://cms.cityoftacoma.org/cityclerk/Files/MunicipalCode/Title13-LandUseRegulatoryCode.PDF\"  target=\"_blank\" title=\"Land Use Regulatory Code\">Land Use Regulatory Code</a><br>";
                      }

                      //Format text with placeholder for highlight function and variable - use a dynamic id value
                      if (fieldName == 'Deed' || fieldName == 'Easement' || fieldName == 'Vacation') {
                        //Add legal document links (some have no document links and have been removed from web service: TACDOCNBR IS NOT NULL)
                        theFormattedResults += "&nbsp;&nbsp;" + fieldName + ": <span id='Highlight" + i + "'></span> |  <a href='http://www.govme.org/gMap/Doc/displayDoc.aspx?category=legaldocs&id=" + results[i].feature.attributes[fieldName] + "' target='_blank' title='View document' >Document</a><br>";
                      } else if (fieldName == 'Kzt') {
                        //Put wind zone values on one line with highlight field
                        theFormattedResults += "&nbsp;&nbsp;" + fieldName + ": <span id='Highlight" + i + "'></span> | IBC: <i>" + results[i].feature.attributes['IBC'] + " mph</i> | IRC: <i>" + results[i].feature.attributes['IRC'] + " mph</i><br>";
                      } else if (results[i].layerId == 15) {
                        //Put Historic Inventory (1979-2004) values on one line with highlight field
                        theFormattedResults += "&nbsp;&nbsp;" + fieldName + ": <span id='Highlight" + i + "'></span> | Link: <a href='https://wspdsmap.cityoftacoma.org/website/HistoricMap/scripts/summary.asp?ID=(" + results[i].feature.attributes['ID'] + ")&map=(" + results[i].feature.attributes['LAT'] + "," + results[i].feature.attributes['LONG'] + ")' title='Inventory Details'  target='_blank'>Inventory Details</a><br>";
                      } else if (results[i].layerId == 1) {
                        //Special formatting for Permit/Site History
                        theFormattedResults += "&nbsp;&nbsp;" + fieldName + ": <span id='Highlight" + i + "'></span><br>";
                        theFormattedResults += "&nbsp;&nbsp;<a href=\"https://wsowa.ci.tacoma.wa.us/cot-itd/addressbased/permithistory.aspx?Address=" + results[i].feature.attributes['Address']  + "&Mode=simple\" target=\"_blank\">E-Vault Document(s)</a><br>";
                      } else {
                        //All other highlight fields
                        theFormattedResults += "&nbsp;&nbsp;" + fieldName + ": <span id='Highlight" + i + "'></span><br>";
                      }

                      //Add geometry info to array for link update later
                      highlightIDs.push(results[i].feature.attributes[fieldName]); //update each layer highlight field - use later to place Highlight function
                      highlightResults.push(results[i].feature); //update with results from each layer - contains geometry for highlighting

                    } else {
                      //Determine format for rest of fields - one or many lines - EVENTUALLY MAKE A LIST OF THESE LAYERS FOR CONFIG
                      if (results[i].layerId >= 1 && results[i].layerId <= 4) {
                        //Skip wind zones (5) because all other field values have been combined with the highlight field
                        //format results on one line - SEND fieldName, results[i].feature.attributes[fieldName]
                        theFormattedResults += this._formatLines(1,fieldName, results[i].feature.attributes[fieldName]);
                      } else if (results[i].layerId == 6 && !publicMap && fieldName == 'WETLANDID') {
                      console.error(publicMap);
                        //Add wetland document links for staff
                        queryWetlandDoc.where = "Wetland_PolygonID = " + results[i].feature.attributes[fieldName];
                        queryTaskWetlandDoc.execute(queryWetlandDoc, this._showWetlandDocs, this._showWetlandDocsError);  //create Wetland Document link(s)

                      } else if (fieldName == 'Lot Size (SF)') {
                      //Check for fields to format as numbers with commas (make a list to check against or default by esriFieldType)
                        theFormattedResults += "&nbsp;&nbsp;" + fieldName + ": <i>" + this._numberWithCommas(results[i].feature.attributes[fieldName]) + "</i><br>";
                        //Add Assessor & MyTacoma after Lot Size
                        theFormattedResults += "&nbsp;&nbsp;Links: <a href=\"http://epip.co.pierce.wa.us/CFApps/atr/epip/summary.cfm?parcel=" + results[i].feature.attributes["Number"]  + "\" target=\"_blank\">" ;
                        theFormattedResults += "Assessor</a> | ";
                        theFormattedResults += "<a href=\"http://www.govme.org/Common/MyTacoma/MyTacoma.aspx?Parcel="+ results[i].feature.attributes["Number"]  + "\" target=\"_blank\">" ;
                        theFormattedResults += "MyTacoma</a><br>&nbsp;<br>";

                      } else if (fieldName == 'E-Vault') {
                        theFormattedResults += "&nbsp;&nbsp;Link: <a href=\"http://www.govme.org/gMap/Info/eVaultFilter.aspx?StreetIDs=" + results[i].feature.attributes["E-Vault"]  + "\" target=\"_blank\">" ;
                        theFormattedResults += "E-Vault Document(s)</a><br>&nbsp;<br>";

                      } else {
                        //format results into many lines
                        //Skip wind zones (5) & Historic Inventory (15) because all other field values have been combined with the highlight field
                        if (results[i].layerId != 5 && results[i].layerId != 15) {
                          theFormattedResults += this._formatLines(2, fieldName, results[i].feature.attributes[fieldName]);
                        }
                         
                      }  //end check for one or many line formatting
                    }
                  }
                  idx++; //add 1 to field index counter
                }  //first check of field types
            }  //end loop through layer fields

            //Update text for each tab - assumption that data is returned sorted by layerId
            if (results[i].layerId == 0) {  //Parcel
              parcel_title = "Parcel Details for " + results[0].feature.attributes["Number"] + ", " + results[0].feature.attributes["Site Address"];  //use first [0] parcel number (reference, not condo)
              parcel_text += theFormattedResults;
              theFormattedResults = "";  //empty the variable
            } else if (results[i].layerId == 1) {  //Parcel
              permit_text += theFormattedResults;
              theFormattedResults = "";  //empty the variable
            } else if ((results[i].layerId >= 2) && (results[i].layerId <= 4)) {  //Vacations, Easements, Deeds
              legal_text += theFormattedResults;
              theFormattedResults = "";  //empty the variable
            } else if ((results[i].layerId >= 5) && (results[i].layerId <= 6)) {  //Wind Zones, Wetland Status
              tab2_text += theFormattedResults;
              theFormattedResults = "";  //empty the variable
            } else if ((results[i].layerId >= 7) && (results[i].layerId <= 9)) {  //Zoning, Recreational Marijuana Zoning, Land Use Designation
              tab4_text += theFormattedResults;
              theFormattedResults = "";  //empty the variable
            } else if ((results[i].layerId >= 10) && (results[i].layerId <= 15)) {  //Historic layers
              historic_text += theFormattedResults;
              theFormattedResults = "";  //empty the variable
            } else {
              tab5_text += theFormattedResults;  //layerID 16 and above
              theFormattedResults = "";  //empty the variable
            }

            //Update previous layer name (check for multiple records for same layer)
            previousLayerName = results[i].layerName;

        }  //end loop through layers

        //Update all tabs with details (or nothing found) - No tab 1 details outside collapsible summaries (will always have a Photo Links summary)
        this.tab2_details.innerHTML = (tab2_text.length>0) ? tab2_text : nothing_text;
        this.tab4_details.innerHTML = (tab4_text.length>0|| historic_text.length>0) ? tab4_text : nothing_text;  //include historic status summary check
        this.tab5_details.innerHTML = (tab5_text.length>0) ? tab5_text : nothing_text;

        //Update tab summaries (collapsible) - title, text details, div id
        this._tabSummaries(parcel_title, parcel_text, this.parcel_details);
        this._tabSummaries("Permit/Site History", permit_text, this.permit_details);
        this._tabSummaries("Legal Documents", legal_text, this.legal_details);
        this._tabSummaries("Photo Links", linkLatLong, this.linkLatLong_details);
        this._tabSummaries("Historic Status", historic_text, this.historic_details);

        //Update fields within tabs the highlight function
        for (var i = 0; i < highlightIDs.length; i++) {
          //Add dynamic highlight function to formatted text
          var list = dojo.byId("Highlight"+i);
          if (i==4){ //Land Use Designation - fix for data error (misspelt Residential)
          	//console.error(i, " - ", highlightIDs[i]);
            domConstruct.create("span", {innerHTML: "<i><span style='color: blue; cursor: pointer;' title='Highlight boundary'>" + highlightIDs[i].replace("Residental", "Residential") + "</span></i>"}, list);
          } else {
            domConstruct.create("span", {innerHTML: "<i><span style='color: blue; cursor: pointer;' title='Highlight boundary'>" + highlightIDs[i] + "</span></i>"}, list);
          }
          //Method to add click event  - Need this.own to maintain scope of dynamic text function within the popup; lang.hitch to keep scope of function within widget
          //Usage syntax: this.own(on(Node, 'click', lang.hitch(this, FUNCTION, param1, param2, etc)));
          this.own(on(list, 'click', lang.hitch(this, this._showFeature, i)));
        }

        this.generalIdNode.innerHTML = "";  //remove progress bar (wait)

      },

      _tabCleanUp: function (){
        //Reset all tab panel details - clear out previous content
        this.parcel_details.innerHTML = "";  //parcel summary results
        this.building_details.innerHTML = "";  //parcel summary results
        this.permit_details.innerHTML = "";  //permit summary results
        this.legal_details.innerHTML = "";  //parcel summary results
        this.linkLatLong_details.innerHTML = "";  //photo links
        this.historic_details.innerHTML = "";  //historic status summary results
        this.wetland_details.innerHTML = "";  //wetland document summary results
        this.arsenic_details.innerHTML = "";  //arsenic document summary results
        this.storm_details.innerHTML = "";  //storm summary results
        this.sewer_details.innerHTML = "";  //storm summary results
      },

      _mapClickHandler: function (evt){
        this._removeGraphic('identify');  //Remove any identify graphic (highlight)
        this._tabCleanUp();  //Reset all panel details - cleanup

        mapClick = webMercatorUtils.webMercatorToGeographic(evt.mapPoint);    //convert map click to lat/long for later links to Bing & Google
        
        //Update all geometry/mapExtent identify parameters
        queryParcelGeometry.geometry = identifyParams.geometry = identifyParamsStorm.geometry = identifyParamsSewer.geometry = identifyParamsArsenic.geometry = evt.mapPoint;    //default geometry is the map click (point)
        identifyParams.mapExtent = identifyParamsStorm.mapExtent = identifyParamsSewer.mapExtent = identifyParamsArsenic.mapExtent = this.map.extent;  //update map extent to determine if layer visibility scale is met
//need to update height & width?
//console.error(identifyParams.geometry,identifyParams.mapExtent)

        //Identify Arsenic Soil Level
        identifyTaskArsenic.execute(identifyParamsArsenic, 
          //put results text inside arsenic_details DIV 
          function(results) { if (results.length>0){
            domConstruct.place('<b><br>Arsenic/Lead</b><br>&nbsp;&nbsp;Estimated Soil Contamination: <i>' + results[0].feature.attributes.NAME + '</i><br>', this.arsenicDiv); } 
           }, function(err) {alert("Error Arsenic Soil Level results: " + err.message);console.error("Arsenic Error: " + err.message);});



        var queryScaleCheck = scaleUtils.getScale(this.map) <= 10000;  //True/false whether to check for buildings (match parcel scale of 10,000)

        //identifying (wait) gif
        this.generalIdNode.innerHTML = "<div class='dijitProgressBar dijitProgressBarEmpty dijitProgressBarIndeterminate' role='progressbar' aria-labelledby='dijit_ProgressBar_0_label' aria-valuemin='0' aria-valuemax='100' id='dijit_ProgressBar_0' widgetid='dijit_ProgressBar_0' style='display: block;'><div data-dojo-attach-point='internalProgress' class='dijitProgressBarFull' style='width: 100%;'><div class='dijitProgressBarTile' role='presentation'></div><span style='visibility:hidden'>&nbsp;</span></div><div data-dojo-attach-point='labelNode' class='dijitProgressBarLabel' id='dijit_ProgressBar_0_label'>&nbsp;</div><span data-dojo-attach-point='indeterminateHighContrastImage' class='dijitInline dijitProgressBarIndeterminateHighContrastImage' src='//js.arcgis.com/3.15/dijit/themes/a11y/indeterminate_progress.gif'></span></div>"
        var panelObject = this;  //save the panel and all it's functions for reference when later updating (instead of using this, lang.hitch, etc)

       //Use map point to query parcel geometry
          var pointORparcel = queryTaskParcelGeometry.execute(queryParcelGeometry);  //QUERY for a parcel at map click
            //Using dojo deferred (1) 'then' function to set callback and errback functions
            pointORparcel.then(function(results) {
                if (results.features.length>0) {
                  //Identify using parcel

                  //Check for only at parcel visibility scales <= 10000
                  if (queryScaleCheck) {
                    //Query for building(s) using parcel number (reference for condos) - simplier way to get all related records
                    //Warning - some buildings can only be found with the Group Account Number - use the Assessor Link when in doubt
                    queryBuilding.where = "PARCELNUMBER='" + results.features[0].attributes['TaxParcelNumber'] + "'";
                    var findBuildings = queryBuildingTask.execute(queryBuilding);  //run building query
                        findBuildings.then(function(results) {
                           if (results.features.length > 0) {panelObject._processQueryResults(results)};  //building(s) found, format results
                         }, function(err) {
                            alert("Error retrieving building results: " + err.message);
                            console.error("Buildings Error: " + err.message);
                        });

                    //Add link to soil database by parcel at WADOE
                    domConstruct.place("<b><br>Arsenic/Lead</b><br>&nbsp;&nbsp;Link: <a href='https://fortress.wa.gov/ecy/areispublic/?Parcel=" + results.features[0].attributes['TaxParcelNumber'] + "'  target='_blank' title='Find EPA Document'>Soil Database (WADOE)</a> for parcel " + results.features[0].attributes['TaxParcelNumber']  + "<br>", this.arsenicDiv);

                  }  //end parcel scale check

                  //BUFFER parcel geometry first before identify - to avoid sliver problems where boundaries don't exactly match parcel edge
                  //assume parcel topologically correct - no need to simplify [geometry]
                  paramsBuffer.geometries = [results.features[0].geometry]; //update the query geometry from map point to parcel boundary (need this to get correct highlight geometry)
                  var bufferedGeometries = gsvc.buffer(paramsBuffer);  //BUFFER the parcel
                    //Using dojo deferred (2) 'then' function to set callback and errback functions
                    bufferedGeometries.then(function(results) {
                        //Identify using parcel (buffer) geometry - Update geometry identify parameter (from map)
                        identifyParams.geometry = identifyParamsStorm.geometry = identifyParamsSewer.geometry = results[0];  //use parcel inside buffer, not map click point (update parameter)
                         //Storm
                        identifyTaskStorm.execute(identifyParamsStorm, function(idResults) { panelObject._processIdentifyResultsStorm(idResults) }, function(idResults){alert('Error in Storm identify, please try again.');console.error("Identify Storm Error: ", idResults);});
                         //Sewer
                        identifyTaskSewer.execute(identifyParamsSewer, function(idResults) { panelObject._processIdentifyResultsSewer(idResults) }, function(idResults){alert('Error in Sewer identify, please try again.');console.error("Identify Sewer Error: ", idResults);});
                        //All others
                        identifyParams.tolerance = 3;  //console.error(identifyParams.tolerance);  //reset to default
                        identifyTask.execute(identifyParams, function(idResults) {  panelObject._processIdentifyResults(idResults) }, function(idResults){alert('Error in identify, please try again.');console.error("Identify Error: ", idResults);});

                     }, function(err) {
                        alert("Error retrieving parcel results: " + err.message);
                        console.error("Parcel Buffer Error: " + err.message);
                    });  
                } else {
                  //Identify using map click geometry - need to run task inside if/then (otherwise both identify task may run before bufferedGeometries)
                  //Storm
                  identifyTaskStorm.execute(identifyParamsStorm, function(idResults) { panelObject._processIdentifyResultsStorm(idResults) }, function(idResults){alert('Error in Storm identify, please try again.');console.error("Identify Storm Error: ", idResults);});
                  //Sewer
                  identifyTaskSewer.execute(identifyParamsSewer, function(idResults) { panelObject._processIdentifyResultsSewer(idResults) }, function(idResults){alert('Error in Sewer identify, please try again.');console.error("Identify Sewer Error: ", idResults);});
                  //All others
                  identifyParams.tolerance = 20;  //console.error(identifyParams.tolerance); //increase to make easy to select street centerline
                  identifyTask.execute(identifyParams, function(idResults) { panelObject._processIdentifyResults(idResults) }, function(idResults){alert('Error in identify, please try again.');console.error("Identify Error: ", idResults);});
                }
 
            }, function(err) {
                alert('Error in parcel identify, please try again.');
                console.error('Parcel Geometry Error: ' + err.message);
            }); 
      },
 
    onOpen: function(){
      //this.inherited(arguments);  //needed??????
      this.generalIdNode.innerHTML = this.nls.label1 + "<br>&nbsp;<br>" + this.nls.label2 + "<br>&nbsp;<br>" + this.nls.label3 + "<br>&nbsp;<br>";  //Help text @ top of panel
      this.map.infoWindow.hide();  //Close any open popups
      defaultClick = this.map.onClick;  //current map click settings
      this.map.onClick = null;  //remove the default map click (disable any layer enabled popups)
      //Map click event - need to make a variable so it can be removed onClose
      mapClickIdentify = this.map.on('click', lang.hitch(this, this._mapClickHandler));  //use hitch() to force the function to retain its original context in subsequent functions
      //!!!close other widget panels from toolbar (especially Layer List - so enable/disable popup doesn't get out of sync)
    },

    onClose: function(){
      this._removeGraphic('identify');  //Remove any identify graphic
      mapClickIdentify.remove();  //stop listening for map click event
      this.map.onClick = defaultClick;  //restore default map click settings (enable any layer enabled popups)
    },

    onMinimize: function(){
      console.log('onMinimize');
    },

    onMaximize: function(){
      console.log('onMaximize');
    },

    onSignIn: function(credential){
      /* jshint unused:false*/
      console.log('onSignIn');
    },

    onSignOut: function(){
      console.log('onSignOut');
    }
  });
});