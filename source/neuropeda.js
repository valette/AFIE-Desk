'use strict';
/* global _ qx desk customViewHelper ThresholdHelper*/

const dir = 'data/NeuroPeda_Light_2013';
const anatFiles = {};
const functionalMaps = {};

var checkBoxColor = "moccasin";
var thresholdColor = "cyan";

desk.FileSystem.traverse( dir, function ( file, callback ) {

    var fileName = desk.FileSystem.getFileName( file );
    if ( desk.FileSystem.getFileExtension( file ) !== "hdr" ) {
        callback();
        return;
    }

    var obj = { file : file };
    var numbers = fileName.match(/\d+/);
    if ( numbers ) {
        obj.id = parseFloat( numbers[ 0 ] );
    }

    const index = fileName.indexOf( 'fonc' );
    if ( index >= 0 ) {
        functionalMaps[ fileName.split( '.')[ 0 ].slice( index ) ] = obj;
    }

    if ( fileName.indexOf( 'anat' ) < 0 ) {
        callback();
        return;
    }

    desk.Actions.execute( {
        action : 'clitkImageInfo',
        inputVolume : file,
        stdout : true
    }, function ( err, res ) {
        let planar = false;
        for ( let dim of res.stdout.split( ' ' )[ 2 ].split( 'x' ) ) {
            if ( parseFloat( dim ) < 2 ) planar = true;
        }
        if ( planar ) {
            callback();
            return;
        }

        anatFiles[ fileName.split( '.')[ 0 ] ] = obj;
        callback();
    } );
}, true, function () {

    function find( files, id ) {
        return _.find( files, file => file.id === id );
    }

    for ( let func of Object.keys( functionalMaps ).sort() ) {

        let mapFile = functionalMaps[ func ];
        const anatFile = find( anatFiles, mapFile.id );

        if ( anatFile ) {

            anatFile.maps = anatFile.maps || {};
            anatFile.maps[ func ] = mapFile.file;

        } else {
            console.warn( 'map ' + mapFile.file + " was not matched to any patient");
        }
    }

    const width = 400;
    const viewer = new desk.VolumeViewer();
    const meshViewer = new desk.SceneContainer();
    viewer.setCustomContainer( meshViewer );
    const model = qx.data.marshal.Json.createModel( Object.keys( anatFiles ).sort() );
    var currentBoxes;
    var list = new qx.ui.form.List();
    list.setWidth( width );
    viewer.getWindow().addAt( list, 0 );

    if ( desk.auto ) {
        viewer.fillScreen();
    } else {
        viewer.getWindow().maximize();
    }


    Object.keys( anatFiles ).forEach( function ( anatFile ) {
        var item = new qx.ui.form.ListItem( anatFile );
        list.add( item );
        var functions = {};
        var file = anatFiles[ anatFile ];
        var maps = file.maps || [];
        file.boxes = Object.keys( maps ).map( function ( functionName ) {
            var box = new qx.ui.form.CheckBox( functionName );
            box.setEnabled( false );
            var helper;
            box.addListener( 'changeValue', function ( e ) {
                if ( e.getData() ) {
                    box.setBackgroundColor( checkBoxColor );
                    helper = new ThresholdHelper( maps[ functionName ] , {
                        sceneContainer : meshViewer,
                        MPRContainer : viewer }, function () {
                            helper.container.setBackgroundColor( thresholdColor );
                            list.addAfter( helper.container, box );
                    } );
                } else {
                    box.setBackgroundColor( "white" );
                    helper.destroy();
                }
            });
            list.add( box );
            return box;
        });
    });

    var previousSelection;

    list.addListener( 'changeSelection', function () {
        if ( list.getSelection().length === 0 ) return;
        var item = list.getSelection()[ 0 ];
        if ( !( item instanceof qx.ui.form.ListItem ) ) {
            if ( previousSelection ) list.setSelection( [ previousSelection ] );
            return;
        }

        if ( item === previousSelection ) return;
        previousSelection = item;

        list.getChildren().slice().forEach( function ( item ) {
            if ( !( item instanceof qx.ui.form.CheckBox ) ) return;
            item.setValue( false );
            item.setEnabled( false );
        });

        const file = anatFiles[ item.getLabel() ];
        customViewHelper( file.file, { sceneContainer : meshViewer, MPRContainer : viewer }, next );

        function next() {
            for ( let box of file.boxes ) {
                box.setEnabled( true );
            }
        }

    });
});