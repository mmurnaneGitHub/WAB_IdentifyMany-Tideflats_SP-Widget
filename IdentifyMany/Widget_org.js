define("dojo/_base/declare dojo/Deferred dojo/_base/lang dojo/dom-construct dojo/on esri/geometry/scaleUtils esri/tasks/BufferParameters esri/tasks/query esri/tasks/QueryTask esri/tasks/IdentifyTask esri/tasks/IdentifyParameters esri/geometry/Geometry esri/tasks/GeometryService esri/geometry/webMercatorUtils esri/symbols/SimpleFillSymbol esri/symbols/SimpleLineSymbol esri/symbols/SimpleMarkerSymbol esri/Color jimu/dijit/TabContainer dijit/TitlePane dijit/_WidgetsInTemplateMixin jimu/BaseWidget".split(" "),
    function(x, I, q, r, y, z, A, l, t, B, u, J, C, D, v, g, w, h, E, F, G, H) {
        return x([H, G], {
            tabContainer: null,
            baseClass: "jimu-widget-identifyMany",
            mapClick: null,
            postCreate: function() {
                this.inherited(arguments);
                this._initTabContainer();
                esri.config.defaults.io.proxyUrl = "/website/DART/StaffMap/proxy/proxy.ashx";
                esri.config.defaults.io.alwaysUseProxy = !1;
                highlightResults = [];
                shapeField1 = /Shape/;
                shapeField2 = /SHAPE/;
                linkValue = /http/;
                myMapWidth = this.map.width;
                myMapHeight = this.map.height;
                myMapSR = this.map.spatialReference;
                symbol_Highlight =
                    new v(v.STYLE_SOLID, g(g.STYLE_SOLID, new h([0, 0, 255]), 2), new h([255, 255, 0, .25]));
                symbol_Highlight_Pt = new w(w.STYLE_SQUARE, 14, new g(g.STYLE_SOLID, new h([0, 0, 255]), 1), new h([0, 0, 255, .25]));
                queryTaskParcelGeometry = new t("https://gis.cityoftacoma.org/arcgis/rest/services/PDS/DARTparcels_PUBLIC/MapServer/3");
                queryParcelGeometry = new l;
                queryParcelGeometry.outFields = ["TaxParcelNumber"];
                queryParcelGeometry.returnGeometry = !0;
                queryParcelGeometry.outSpatialReference = myMapSR;
                queryBuildingTask = new t("https://gis.cityoftacoma.org/arcgis/rest/services/PDS/CompPlan_Query/MapServer/16");
                queryBuilding = new l;
                queryBuilding.returnGeometry = !1;
                queryBuilding.outFields = "BUILDINGID PARCELNUMBER PROPERTYTYPE PRIMARYOCCUPANCYDESCRIPTION SQUAREFEET NETSQUAREFEET".split(" ");
                queryBuilding.orderByFields = ["BUILDINGID"];
                gsvc = new C("https://gis.cityoftacoma.org/arcgis/rest/services/Utilities/Geometry/GeometryServer");
                paramsBuffer = new A;
                paramsBuffer.distances = [-2];
                paramsBuffer.bufferSpatialReference = new esri.SpatialReference({
                    wkid: 102100
                });
                paramsBuffer.outSpatialReference = myMapSR;
                paramsBuffer.unit =
                    esri.tasks.GeometryService.UNIT_FOOT;
                identifyTask = new B("https://gis.cityoftacoma.org/arcgis/rest/services/PDS/CompPlan_Query/MapServer");
                identifyParams = new u;
                identifyParams.returnGeometry = !0;
                identifyParams.layerIds = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
                identifyParams.layerOption = u.LAYER_OPTION_VISIBLE;
                identifyParams.width = myMapWidth;
                identifyParams.height = myMapHeight;
                identifyParams.spatialReference = myMapSR;
                identifyParams.tolerance = 3
            },
            startup: function() {
                this.inherited(arguments)
            },
            _initTabContainer: function() {
                var a = [];
                a.push({
                    title: this.nls.tab1label,
                    content: this.tabNode1
                });
                a.push({
                    title: this.nls.tab4label,
                    content: this.tabNode4
                });
                a.push({
                    title: this.nls.tab5label,
                    content: this.tabNode5
                });
                this.selTab = this.nls.tab1label;
                this.tabContainer = new E({
                    tabs: a,
                    selected: this.selTab
                }, this.tabIdentify);
                this.tabContainer.startup()
            },
            _removeGraphic: function(a) {
                dojo.forEach(this.map.graphics.graphics, function(b) {
                    b && b.id === a && this.map.graphics.remove(b)
                }, this)
            },
            _tabSummaries: function(a, b, d) {
                0 < b.length && (a = new F({
                    title: a,
                    open: !1,
                    content: b
                }), d.appendChild(a.domNode), r.place("<br>", d, "first"))
            },
            _showFeature: function(a, b) {
                this._removeGraphic("identify");
                var d = highlightResults[a];
                "point" == d.geometry.type ? d.setSymbol(symbol_Highlight_Pt) : d.setSymbol(symbol_Highlight);
                d.geometry.spatialReference = myMapSR;
                d.id = "identify";
                this.map.graphics.add(d)
            },
            _numberWithCommas: function(a) {
                return a ? a.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") : 0
            },
            _processQueryResults: function(a) {
                var b = "",
                    d = "Building Summary";
                1 < a.features.length && (d += ", " +
                    a.features.length + " buildings on parcel");
                var e = [];
                for (fieldName in a.fieldAliases) e.push(a.fieldAliases[fieldName]);
                for (var k = 0; k < a.features.length; k++) {
                    var f = 0;
                    for (fieldName in a.features[k].attributes) 1 != f && (b = 4 == f || 5 == f ? b + ("&nbsp;&nbsp;" + e[f] + ": <i>" + this._numberWithCommas(a.features[k].attributes[fieldName]) + "</i><br>") : b + ("&nbsp;&nbsp;" + e[f] + ": <i>" + a.features[k].attributes[fieldName] + "</i><br>")), f++;
                    b += "<br>"
                }
                this._tabSummaries(d, b, this.building_details)
            },
            _formatLines: function(a, b, d) {
                var e =
                    "";
                1 == a ? "ADDRESSID" != b && (e += "&nbsp;&nbsp;" + b + ": <i>" + d + "</i> &nbsp;&nbsp;") : e = "Potential Zoning" == b ? e + ("<br>&nbsp;&nbsp;<b>" + b + "</b>: <i>" + d + "</i><br>&nbsp;<br>") : e + ("&nbsp;&nbsp;" + b + ": <i>" + d + "</i><br>");
                return e
            },
            _processIdentifyResults: function(a) {
                var b = "",
                    d = "",
                    e = "",
                    k = "",
                    f = "",
                    g = "",
                    h = "";
                highlightResults = [];
                var n = [],
                    p = "",
                    m = '&bull; &nbsp;<a href="https://www.bing.com/maps/?v=2&cp=' + mapClick.y + "~" + mapClick.x + '&lvl=19&sty=b" target="_blank">';
                m = m + "Bird's Eye Photo (Microsoft Bing)</a>" + ('<br>&bull; &nbsp;<a href="https://wspdsmap.cityoftacoma.org/website/BLUS/StreetView.htm?lat=' +
                    mapClick.y + "&lon=" + mapClick.x + '" target="_blank">');
                m += "Street View Photo (Google Maps)</a>";
                for (var c = 0; c < a.length; c++) {
                    p != a[c].layerName && 0 != a[c].layerId && 1 != a[c].layerId && (b += "<b><br>" + a[c].layerName + "</b><br>");
                    var l = 0;
                    for (fieldName in a[c].feature.attributes) "Null" === a[c].feature.attributes[fieldName] || " " === a[c].feature.attributes[fieldName] || "OBJECTID" === fieldName || "ENTITYID" === fieldName || "FID" === fieldName || shapeField1.test(fieldName) || shapeField2.test(fieldName) || (linkValue.test(a[c].feature.attributes[fieldName]) ?
                        b += "&nbsp;&nbsp;<a href='" + a[c].feature.attributes[fieldName] + "' target='_blank' title='View document'>" + fieldName + "</a><br>" : 0 == l ? ("Zoning District" == fieldName && p != a[c].layerName && (b += '&nbsp;&nbsp;<a href="http://cms.cityoftacoma.org/Planning/Zoning%20Reference%20Guide%202016.pdf"  target="_blank" title="Zoning Descriptions">Zoning Descriptions</a><br>', b += '&nbsp;&nbsp;<a href="http://cms.cityoftacoma.org/cityclerk/Files/MunicipalCode/Title13-LandUseRegulatoryCode.PDF"  target="_blank" title="Land Use Regulatory Code">Land Use Regulatory Code</a><br>'),
                            10 == a[c].layerId ? b += "&nbsp;&nbsp;" + fieldName + ": <span id='Highlight" + c + "'></span> | Link: <a href='https://wspdsmap.cityoftacoma.org/website/HistoricMap/scripts/summary.asp?ID=(" + a[c].feature.attributes.ID + ")&map=(" + a[c].feature.attributes.LAT + "," + a[c].feature.attributes.LONG + ")' title='Inventory Details'  target='_blank'>Inventory Details</a><br>" : 1 == a[c].layerId ? (b += "&nbsp;&nbsp;" + fieldName + ": <span id='Highlight" + c + "'></span><br>", b += '&nbsp;&nbsp;<a href="https://wsowa.ci.tacoma.wa.us/cot-itd/addressbased/permithistory.aspx?Address=' +
                                a[c].feature.attributes.Address + '&Mode=simple" target="_blank">E-Vault Document(s)</a><br>') : b += "&nbsp;&nbsp;" + fieldName + ": <span id='Highlight" + c + "'></span><br>", n.push(a[c].feature.attributes[fieldName]), highlightResults.push(a[c].feature)) : 1 == a[c].layerId ? b += this._formatLines(1, fieldName, a[c].feature.attributes[fieldName]) : "Lot Size (SF)" == fieldName ? (b += "&nbsp;&nbsp;" + fieldName + ": <i>" + this._numberWithCommas(a[c].feature.attributes[fieldName]) + "</i><br>", b += '&nbsp;&nbsp;Links: <a href="http://epip.co.pierce.wa.us/CFApps/atr/epip/summary.cfm?parcel=' +
                            a[c].feature.attributes.Number + '" target="_blank">', b += "Assessor</a> | ", b += '<a href="http://www.govme.org/Common/MyTacoma/MyTacoma.aspx?Parcel=' + a[c].feature.attributes.Number + '" target="_blank">', b += "MyTacoma</a><br>&nbsp;<br>") : 10 != a[c].layerId && (b += this._formatLines(2, fieldName, a[c].feature.attributes[fieldName])), l++);
                    0 == a[c].layerId ? (d = "Parcel Details for " + a[0].feature.attributes.Number + ", " + a[0].feature.attributes["Site Address"], e += b) : 1 == a[c].layerId ? k += b : 2 <= a[c].layerId && 4 >= a[c].layerId ?
                        g += b : 5 <= a[c].layerId && 10 >= a[c].layerId ? f += b : h += b;
                    b = "";
                    p = a[c].layerName
                }
                this.tab4_details.innerHTML = 0 < g.length || 0 < f.length ? g : "Nothing Found";
                this.tab5_details.innerHTML = 0 < h.length ? h : "Nothing Found";
                this._tabSummaries(d, e, this.parcel_details);
                this._tabSummaries("Permit/Site History", k, this.permit_details);
                this._tabSummaries("Photo Links", m, this.linkLatLong_details);
                this._tabSummaries("Historic Status", f, this.historic_details);
                for (c = 0; c < n.length; c++) a = dojo.byId("Highlight" + c), r.create("span", {
                    innerHTML: "<i><span style='color: blue; cursor: pointer;' title='Highlight boundary'>" +
                        n[c] + "</span></i>"
                }, a), this.own(y(a, "click", q.hitch(this, this._showFeature, c)));
                this.generalIdNode.innerHTML = ""
            },
            _tabCleanUp: function() {
                this.parcel_details.innerHTML = "";
                this.building_details.innerHTML = "";
                this.permit_details.innerHTML = "";
                this.linkLatLong_details.innerHTML = "";
                this.historic_details.innerHTML = ""
            },
            _mapClickHandler: function(a) {
                this._removeGraphic("identify");
                this._tabCleanUp();
                mapClick = D.webMercatorToGeographic(a.mapPoint);
                queryParcelGeometry.geometry = identifyParams.geometry = a.mapPoint;
                identifyParams.mapExtent = this.map.extent;
                var b = 1E4 >= z.getScale(this.map);
                this.generalIdNode.innerHTML = "<div class='dijitProgressBar dijitProgressBarEmpty dijitProgressBarIndeterminate' role='progressbar' aria-labelledby='dijit_ProgressBar_0_label' aria-valuemin='0' aria-valuemax='100' id='dijit_ProgressBar_0' widgetid='dijit_ProgressBar_0' style='display: block;'><div data-dojo-attach-point='internalProgress' class='dijitProgressBarFull' style='width: 100%;'><div class='dijitProgressBarTile' role='presentation'></div><span style='visibility:hidden'>&nbsp;</span></div><div data-dojo-attach-point='labelNode' class='dijitProgressBarLabel' id='dijit_ProgressBar_0_label'>&nbsp;</div><span data-dojo-attach-point='indeterminateHighContrastImage' class='dijitInline dijitProgressBarIndeterminateHighContrastImage' src='//js.arcgis.com/3.15/dijit/themes/a11y/indeterminate_progress.gif'></span></div>";
                var d = this;
                queryTaskParcelGeometry.execute(queryParcelGeometry).then(function(a) {
                    0 < a.features.length ? (b && (queryBuilding.where = "PARCELNUMBER='" + a.features[0].attributes.TaxParcelNumber + "'", queryBuildingTask.execute(queryBuilding).then(function(a) {
                        0 < a.features.length && d._processQueryResults(a)
                    }, function(a) {
                        alert("Error retrieving building results: " + a.message);
                        console.error("Buildings Error: " + a.message)
                    })), paramsBuffer.geometries = [a.features[0].geometry], gsvc.buffer(paramsBuffer).then(function(a) {
                        identifyParams.geometry =
                            a[0];
                        identifyTask.execute(identifyParams, function(a) {
                            d._processIdentifyResults(a)
                        }, function(a) {
                            alert("Error in identify, please try again.");
                            console.error("Identify Error (parcel geometry): ", a)
                        })
                    }, function(a) {
                        alert("Error retrieving parcel results: " + a.message);
                        console.error("Parcel Buffer Error: " + a.message)
                    })) : identifyTask.execute(identifyParams, function(a) {
                        d._processIdentifyResults(a)
                    }, function(a) {
                        alert("Error in identify, please try again.");
                        console.error("Identify Error (map click geometry): ",
                            a)
                    })
                }, function(a) {
                    alert("Error in parcel identify, please try again.");
                    console.error("Parcel Geometry Error: " + a.message)
                })
            },
            onOpen: function() {
                this.generalIdNode.innerHTML = this.nls.label1 + "<br>&nbsp;<br>" + this.nls.label2 + "<br>&nbsp;<br>" + this.nls.label3 + "<br>&nbsp;<br>";
                this.map.infoWindow.hide();
                defaultClick = this.map.onClick;
                this.map.onClick = null;
                mapClickIdentify = this.map.on("click", q.hitch(this, this._mapClickHandler))
            },
            onClose: function() {
                this._removeGraphic("identify");
                mapClickIdentify.remove();
                this.map.onClick = defaultClick
            },
            onMinimize: function() {
                console.log("onMinimize")
            },
            onMaximize: function() {
                console.log("onMaximize")
            },
            onSignIn: function(a) {
                console.log("onSignIn")
            },
            onSignOut: function() {
                console.log("onSignOut")
            }
        })
    });