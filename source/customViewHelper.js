'use strict';
/* global desk qx THREE define self*/

var customViewHelper = function( brainFile, options, callback ) {
    options = options || {};
    var patientMeshFile = options.mesh;

    if ( typeof options === "function" ) {
        callback = options;
        options = { };
    }
    var viewer = options.MPRContainer;
    viewer.removeAllVolumes();

    var meshViewer = options.sceneContainer;
    meshViewer.removeAllMeshes();
    meshViewer.getControls().enabled = false;

    viewer.addVolume( brainFile, { format : 0, label : "brain" }, after );
    var brightnessContrastIcon;

    function after ( err, volume ) {
        brightnessContrastIcon = volume.getChildren()[ 1 ].getChildren()[ 0 ];
        meshViewer.add( brightnessContrastIcon, { top: 0, left: 0 } );

        if ( err ) {
            callback( err );
            return;
        }
        if ( patientMeshFile || ( patientMeshFile === '' ) ) {
            next( volume );
            return;
        }
        var slice = viewer.getVolumeSlices( volume )[ 0 ];
        var max = slice.getScalarBounds()[ 1 ];
        desk.Actions.execute( {
            action : 'extract_meshes',
            threshold : 0.05 * max,
            input_volume : brainFile,
            max_number_of_vertices : 2000,
            cleaning : 1
        }, function ( err, res ) {
            if ( err ) {
                callback( err );
                return;
            }
            patientMeshFile = res.outputDirectory + "/1.vtk";
            next( volume );
        });
    }

    function next ( volume ) {
        var id = viewer.addListener( 'removeVolume', function ( e ) {
            if ( e.getData() !== volume ) return;
            viewer.removeListenerById( id );
            brightnessContrastIcon.destroy();
        });


        meshViewer.attachVolumeSlices( viewer.getVolumeSlices( volume ) );
        meshViewer.rotateView( 0, -0.5 * Math.PI, 0 );
        meshViewer.rotateView( 0.75 * Math.PI, 0, 0 );
        meshViewer.rotateView( 0, 0.1 * Math.PI, 0 );

        viewer.getViewers()[ 1 ].rotate( -1 );

        if ( patientMeshFile !== '' ) {
            meshViewer.addFile( patientMeshFile, next2 );
        } else {
            if ( callback ) callback ( null, viewer );
        }
    }

    function next2 ( mesh ) {
        mesh.material.transparent = true; 
        mesh.material.opacity = 0.5;
        mesh.renderOrder = 4;
        mesh.material.color.set( "pink" );
        if ( callback ) callback ( null, viewer );
    }

};


if ( typeof define === 'function' && define.amd ) {

    define( 'customViewHelper', customViewHelper );
    if ( Promise.promisify ) {
        define( 'customViewHelperAsync', Promise.promisify ( customViewHelper ) );
    }

} else if ( 'undefined' !== typeof exports && 'undefined' !== typeof module ) {

    module.exports = ThresholdHelper;

} else {

    self.customViewHelper = customViewHelper;
    if ( Promise.promisify ) {
        self.customViewHelperAsync = Promise.promisify ( customViewHelper );
    }

}



