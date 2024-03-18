import * as React from 'react';
import { View, StyleSheet, PixelRatio, LayoutChangeEvent, Animated } from 'react-native';
import { PanGestureHandler, PanGestureHandlerGestureEvent, State } from 'react-native-gesture-handler';
import Svg, { G, Path } from 'react-native-svg';
import { captureRef as takeSnapshotAsync } from 'react-native-view-shot';

interface SignaturePanelProps {
  containerStyle?: object;
  width?: string | number;
  height?: string | number;
  offsetX?: number;
  offsetY?: number;
  strokeColor?: string;
  strokeWidth?: number;
  onFingerUp?: (...args: any[]) => any;
  onTouch?: (...args: any[]) => any;
  onTouchEnd?: (...args: any[]) => any;
  imageOutputSize?: number;
  imageQuality?: number;
  imageFormat?: 'jpg' | 'png' | 'webm' | 'raw';
  outputType?: 'tmpfile' | 'base64' | 'data-uri' | 'zip-base64';
}

interface SignaturePanelState {
  paths: any[];
  points: any[];
  posX: number;
  posY: number;
}

class SignaturePanel extends React.Component<SignaturePanelProps, SignaturePanelState> {
  public static defaultProps: SignaturePanelProps = {
    height: 300,
    imageFormat: 'png',
    imageOutputSize: 480,
    imageQuality: 1,
    offsetX: 0,
    offsetY: 0,
    onFingerUp: () => {},
    onTouch: () => {},
    onTouchEnd: () => {},
    outputType: 'tmpfile',
    strokeColor: '#000',
    strokeWidth: 3,
    width: '100%',
  };

  public static timer: any = null;
  private signatureContainer = React.createRef<View>();

  constructor(props: SignaturePanelProps) {
    super(props);
    this.state = {
      paths: [],
      points: [],
      posX: 0,
      posY: 0,
    };
  }
  public render() {
    const { containerStyle, width, height } = this.props;
    const { paths, points } = this.state;
    return (
      <PanGestureHandler
        minDeltaX={0}
        minDeltaY={0}
        maxPointers={1}
        minPointers={1}
        shouldCancelWhenOutside={true}
        onHandlerStateChange={(e) => {
          if (e.nativeEvent.oldState === State.ACTIVE && e.nativeEvent.state === State.END) this.onTouchEnd();
          else if (e.nativeEvent.state === State.BEGAN) this.onTouch(e);
        }}
        onGestureEvent={(e) => this.onTouch(e)}
      >
        <Animated.View
          ref={this.signatureContainer}
          onLayout={this.onLayoutContainer}
          style={[containerStyle, { width, height }]}
        >
          {this.renderSvg(paths, points)}
        </Animated.View>
      </PanGestureHandler>
    );
  }

  /**
   * Resets the signature pad container
   * @param {GestureResponderEvent} e Event
   * @public
   */
  public reset() {
    this.setState({
      paths: [],
      points: [],
      posX: 0,
      posY: 0,
    });
  }

  /**
   * Detect the touch start and move events on the signature pad
   * @param {GestureResponderEvent} e Event
   * @private
   */

  private onTouch(e: PanGestureHandlerGestureEvent) {
    const { x: locationX, y: locationY } = e.nativeEvent;

    const { points } = this.state;
    if (SignaturePanel.timer) {
      clearTimeout(SignaturePanel.timer);
    }
    this.setState({
      paths: this.state.paths,
      points: [...points, { locationX, locationY }],
    });

    this.props.onTouch?.(e);
  }

	/**
	 * Detect when the user has finished the gesture
	 * @private
	 */

	private onTouchEnd() {
		const { paths, points } = this.state;
		const { strokeColor, strokeWidth } = this.props;
		const newPath = <Path d={this.plotToSvg(points)} stroke={strokeColor} strokeWidth={strokeWidth} fill="none" />;
		this.setState(
			{
				paths: [...paths, newPath],
				points: [],
			},
			this.returnImageData({ paths, points })
		);

		this.props.onTouchEnd();
	}

	/**
	 * Plots the captured points to an array
	 * @param {Array} points Points
	 * @return {any}
	 * @private
	 */

	private plotToSvg(points: any[]) {
		const { posX, posY } = this.state;
		if (points.length > 0) {
			let path = `M ${points[0].locationX - posX},${points[0].locationY - posY}`;
			points.forEach(point => {
				path += ` L ${point.locationX - posX},${point.locationY - posY}`;
			});
			return path;
		} else {
			return '';
		}
	}

	/**
	 * Takes the points and forms an SVG from them
	 * @param {Array} paths
	 * @param {Array} points
	 * @return {Element}*
	 * @private
	 */

	private renderSvg = (paths: any[], points: any[]) => {
		const { width, height, strokeColor, strokeWidth } = this.props;
		return (
			<Svg style={styles.pad} width={width} height={height}>
				<G>
					{paths.map((path, i) => {
						return <React.Fragment key={`path-${i}`}>{path}</React.Fragment>;
					})}
					<Path d={this.plotToSvg(points)} stroke={strokeColor} strokeWidth={strokeWidth} fill="none" />
				</G>
			</Svg>
		);
	};

	/**
	 * Sets the layout view
	 * @param {LayoutChangeEvent} e Event
	 * @private
	 */

	private onLayoutContainer = (e: LayoutChangeEvent) => {
		const { x, y } = e.nativeEvent.layout;
		const { offsetX, offsetY } = this.props;
		this.setState({
			posX: x + offsetX,
			posY: y + offsetY,
		});
	};

	/**
	 * Creates a snapshot image from the view container
	 * @param {Array} paths
	 * @param {Array} points
	 * @return {SignaturePanelProps['onFingerUp']}*
	 * @private
	 */

	private returnImageData({ paths, points }: { paths: any[]; points: any[] }) {
		const { onFingerUp, onFingerUpTimeout, imageFormat, outputType, imageOutputSize, imageQuality } = this.props;
		return () => {
			if (!['jpg', 'png', 'webm', 'raw'].includes(imageFormat)) {
				onFingerUp(this.renderSvg(paths, points));
			} else {
				const pixelRatio = PixelRatio.get();
				const pixels = imageOutputSize / pixelRatio;
				SignaturePanel.timer = setTimeout(async () => {
					const file = await takeSnapshotAsync(this.signatureContainer, {
						format: imageFormat,
						height: pixels,
						quality: imageQuality,
						result: outputType,
						width: pixels,
					});
					onFingerUp(file);
					SignaturePanel.timer = null;
				}, onFingerUpTimeout);
			}
		};
	}
}

const styles = StyleSheet.create({
	pad: {
		backgroundColor: 'transparent',
	},
});
export default SignaturePanel;
