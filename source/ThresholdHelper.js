"use strict";
/* global qx desk THREE define self */

var ThresholdHelper = function( volume , options, callback ) {

    var MPRContainer = this.MPRContainer = options.MPRContainer;
    var sceneContainer = this.sceneContainer = options.sceneContainer;
    var opacitySlider, visibilityBox;

    // colors
    var paletteSize = 2000;
    var red   = [];
    var green = [];
    var blue  = [];
    var alpha = [];

	var colorConverter = new THREE.Color();

    for ( var i = 0; i < paletteSize; i++ ) {

    	colorConverter.setHSL( ( 1 - i / paletteSize )  * 230 / 360, 1, 0.5 );
        red[i] = 255 * colorConverter.r;
        green[i] = 255 * colorConverter.g;
        blue[i] = 255 * colorConverter.b;
        alpha[i] = 255;

    }
    var colors = [red, green, blue, alpha];
    MPRContainer.addVolume( volume, 
        { opacity : 0.4, colors : colors, format : 0, label : 'threshold' }, next, this );

    this.container = new qx.ui.container.Composite( new qx.ui.layout.VBox() );

    function next( err, volume ) {

        this.volume = volume;
        opacitySlider = this.opacitySlider = volume.getChildren()[ 1 ].getChildren()[ 2 ];
        visibilityBox = this.visibilityBox = volume.getChildren()[ 1 ].getChildren()[ 3 ];
        this.container.add( opacitySlider );
        var cont = new qx.ui.container.Composite( new qx.ui.layout.HBox() );
        cont.add( new qx.ui.basic.Label('visible') );
        cont.add( new qx.ui.core.Spacer( 10 ) );
        cont.add( visibilityBox );
        cont.add( new qx.ui.core.Spacer( 10 ) );
        cont.add( opacitySlider, { flex : 1 } );
        if ( err ) {
            callback( err );
            return;
        }
        this.container.add( cont );
        var volumeSlice = MPRContainer.getVolumeSlices( volume )[ 0 ];

        var slices = MPRContainer.getVolumeMeshes( volume );
        hackShaders( volumeSlice, slices );

        var meshes = sceneContainer.attachVolumeSlices( MPRContainer.getVolumeSlices( volume ) );
        hackShaders ( volumeSlice, meshes );
        this.meshes = meshes;

        var slider = this.slider = new qx.ui.form.Slider( 'horizontal');
        var res = 256;
        slider.setMaximum( res );
        slider.setToolTipText( 'Change threshold max' );
        slider.addListener( 'changeValue', function () {
            slices.forEach( updateSlice );
            meshes.forEach( updateSlice );
            sceneContainer.render();
            MPRContainer.render();
        });

        var slider2 = this.slider2 = new qx.ui.form.Slider( 'horizontal');
        slider2.setMaximum( res );
        slider2.setToolTipText( 'Change threshold min' );
        slider2.addListener( 'changeValue', function () {
            slices.forEach( updateSlice );
            meshes.forEach( updateSlice );
            sceneContainer.render();
            MPRContainer.render();
        });

        function updateSlice( slice ) {
            var maxValue = min + range * slider.getValue() / ( res - 1 );
            maxLabel.setValue('' + maxValue.toFixed( 2 ) );
            slice.material.uniforms.thresholdMax.value = maxValue;
            var minValue = min + range * slider2.getValue() / ( res - 1 );
            slice.material.uniforms.thresholdMin.value = minValue;
            minLabel.setValue('' + minValue.toFixed( 2 ) );
        }

//        sceneContainer.add(slider, { left : 50, bottom : 20, width : "70%" } );
//        sceneContainer.add(slider2, { left : 50, bottom : 0, width : "70%" } );
        var cont2 = new qx.ui.container.Composite( new qx.ui.layout.HBox() );
        cont2.add( new qx.ui.basic.Label('max ') );
        cont2.add( new qx.ui.core.Spacer( 10 ) );
        var maxLabel = new qx.ui.basic.Label( '' );
        cont2.add( maxLabel );
        cont2.add( new qx.ui.core.Spacer( 10 ) );
        cont2.add( slider, { flex : 1 } );
        this.container.add( cont2 );
        var cont3 = new qx.ui.container.Composite( new qx.ui.layout.HBox() );
        cont3.add( new qx.ui.basic.Label( 'min ' ) );
        cont3.add( new qx.ui.core.Spacer( 12 ) );
        var minLabel = new qx.ui.basic.Label( '' );
        cont3.add( minLabel );
        cont3.add( new qx.ui.core.Spacer( 10 ) );
        cont3.add( slider2, { flex : 1 } );
        this.container.add( cont3 );
        var multiplier = options.multiplier || 1;
        var bounds = volumeSlice.getScalarBounds();
        var min = bounds[ 0 ];
        var range = bounds[ 1 ] - min;
        multiplier *= 0.5 * volumeSlice.getScalarBounds()[ 1 ];
        slider.setValue( res );
        slider2.setValue( 0 );

        if ( callback ) callback ( null );
    }

    function hackShadersOld ( volumeSlice, meshes ) {
        meshes.forEach( function ( slice ) {
            var shader = slice.material.baseShader;
    		shader.extraUniforms.push( { name : 'threshold', type: "f", value: 1000000 } );
            shader.extraShaders.push(
                [ 'if ( value < threshold ) {',
                    'discard;',
                '} else {',
                    'gl_FragColor.r = 1.0;',
                    'gl_FragColor.g = 0.0;',
                    'gl_FragColor.b = 0.0;',
                    'gl_FragColor.a = opacity;',
                '}' ].join( '\n' ) );
            volumeSlice.updateMaterial( slice.material );
        });
    }

    function hackShaders ( volumeSlice, meshes ) {
        meshes.forEach( function ( slice ) {
            var shader = slice.material.baseShader;
    		shader.extraUniforms.push( { name : 'thresholdMin', type: "f", value: -1000000 } );
    		shader.extraUniforms.push( { name : 'thresholdMax', type: "f", value: 1000000 } );
            shader.extraShaders.push( [
                'if ( ( value > thresholdMax ) || ( value < thresholdMin ) || ( value == 0.0 ) ) {',
                    'discard;',
                '} else {',
        			'float range = thresholdMax - thresholdMin;',
        			'correctedValue = ( value - thresholdMin ) / range;',
        			'colorIndex = vec2( correctedValue, 0.0 );',
        			'gl_FragColor = texture2D( lookupTable,colorIndex  );',
                    'gl_FragColor.a = opacity;',
               '}'
                ].join( '\n' ) );
            volumeSlice.updateMaterial( slice.material );
        });
    }
};

ThresholdHelper.prototype.destroy = function () {

    this.meshes.forEach( this.sceneContainer.removeMesh.bind( this.sceneContainer ) ) ;
    this.MPRContainer.removeVolume( this.volume );
    this.container.destroy();
    this.slider.destroy();
    this.slider2.destroy();
    this.opacitySlider.destroy();

};

if ( typeof define === 'function' && define.amd ) {

    define( 'ThresholdHelper', ThresholdHelper );
    if ( Promise.promisify ) {
        define( 'ThresholdHelperAsync', Promise.promisify ( ThresholdHelper ) );
    }

} else if ( 'undefined' !== typeof exports && 'undefined' !== typeof module ) {

    module.exports = ThresholdHelper;

} else {

    self.ThresholdHelper = ThresholdHelper;
    if ( Promise.promisify ) {
        self.ThresholdHelperAsync = Promise.promisify ( ThresholdHelper );
    }

}


