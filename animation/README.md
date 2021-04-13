# Animation Sample

__Released:__ HC 2021 SP1

This sample demonstrates how to programmatically animate a 3D model using the HOOPS Communicator Animation API by building a native JavaScript class, `MicroengineAnimator`.

Understanding how `MicroengineAnimator` works will provide you with enough knowledge to begin building your own animations with the HOOPS Web Viewer.

Please follow the [repository installation instructions](../README.md) located at the root of this project if you have not done so already.

## Content

The `MicroengineAnimator` class is located in the file `samples/animation/microengineAnimator.js` and a demonstration can be found in the file `samples/animation/index.html`.

## View the Sample

Start the [Quickstart server](https://docs.techsoft3d.com/communicator/latest/build/overview/getting-started.html) and visit [http://localhost:11180/hc_quickstart_samples/animation/index.html?viewer=CSR&instance=microengine](http://localhost:11180/hc_quickstart_samples/animation/index.html?viewer=CSR&instance=microengine).

Press the different "Play Animation" buttons to see the HOOPS Communicator Animation API in action!

## Documentation

See our official [Animation Programming Guide](https://docs.techsoft3d.com/communicator/latest/build/prog_guide/viewing/animation.html) for more information.

### MicroengineAnimator

This wrapper class contains all the HOOPS Communicator Animation API logic required for this animation sample. We recommend you review `MicroengineAnimator.addTranslationAnimation(...)` to understand how this wrapper class is managing its state and data. As well, all other `MicroengineAnimator.add_____Animation(...)` functions follow a similar pattern, but reveal the unique data points and details for a variety of different animations.

See the [Node Animation](https://docs.techsoft3d.com/communicator/latest/build/prog_guide/viewing/animation.htm#toc_node_animation) section of our Programming Guide for a detailed explanation of `MicroengineAnimator.addTranslationAnimation(...)`.

### Demonstration

A `<script>` is located at the bottom of the `<body>` tag in `index.html`. First, the script loads the `microengine` model provided with the Quickstart server. Then, it defines unique event handlers for each "Play Animation" button.

#### Animation 1

This button demonstrates the following animations (chronological order):

- Move the camera into a new position
- Fully remove three screws from the housing back
- Partial remove the last screw
- Rotate the housing back with the partially removed screw as a pivot point

#### Animation 2

This animation is similar to Animation 1, but it does not reset the camera between plays.