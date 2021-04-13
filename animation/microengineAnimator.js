class MicroengineAnimator {
    constructor(viewer, animationName) {
        this._viewer = viewer;
        this._animation = new Communicator.Animation.Animation(animationName);
        this._channelMap = new Map();
        this._player = this._viewer.animationManager.createPlayer(this._animation);
        this._currentCamera;
        this._nodeMatrixes = {};  // Object to keep node matrix while animation
        this._nodeOpacities = {};  // Object to keep node opacity while animation
        this._nodeVisibilities = {};   // Object to keep node visibility while animation
        this._nodeColors = {};  // Object to keep node color while animation
        this._hasRotated = {};
        this._isPause = false;
    }

    /* Helper Functions */
    // You may find a need for these functions, or something similar, for your animation implementation. These functions focus on calculating a node rotation and considering local rotations of a Node while translating or rotating a Node. In some cases, failing to consider the local rotation can cause undesired animation behavior.

    // Rotate a node counter-clockwise a half-turn
    _setQuatAxisAngle(out, axis, rad) {
        rad = rad * 0.5;
        let s = Math.sin(rad);
        out.x = s * axis.x;
        out.y = s * axis.y;
        out.z = s * axis.z;
        out.w = Math.cos(rad);
    
        return out;
    }

    _convertLocalVector(nodeId, vector) {
        // Compute inverse matrix of the parent node
        const parentNode = this._viewer.model.getNodeParent(nodeId);
        const netMatrix = this._viewer.model.getNodeNetMatrix(parentNode);
        const inverseMatrix = new Communicator.Matrix.inverse(netMatrix);

        // Convert vector of the parent node 
        const localOrg = Communicator.Point3.zero();
        inverseMatrix.transform(Communicator.Point3.zero(), localOrg);

        const localVector = Communicator.Point3.zero();
        inverseMatrix.transform(vector, localVector);

        localVector.subtract(localOrg);

        // Return the local vector
        return localVector;
    }

    // Consider a Nodes local rotation while rotating a Node
    _convertLocalRotation(nodeId, beforeMatrix, rotationAxsis, rotationCenter, rotationAngle) {
        // Compute inverse matrix of the parent node
        const parentNode = this._viewer.model.getNodeParent(nodeId);
        const netMatrix = this._viewer.model.getNodeNetMatrix(parentNode);
        const inverseMatrix = new Communicator.Matrix.inverse(netMatrix);
        
        // Conpute rotatation vector in the parent node 
        const localAxis0 = Communicator.Point3.zero();
        inverseMatrix.transform(Communicator.Point3.zero(), localAxis0);

        const localAxis = Communicator.Point3.zero();
        inverseMatrix.transform(rotationAxsis, localAxis);

        localAxis.subtract(localAxis0);

        // Create local rotation matrix
        const rotationMatrix = Communicator.Matrix.createFromOffAxisRotation(localAxis, rotationAngle);

        // Node matrix * rotation matrix
        const multiplyMatrix = Communicator.Matrix.multiply(beforeMatrix, rotationMatrix);

        // Compute local center point
        const localCenter = Communicator.Point3.zero();
        inverseMatrix.transform(rotationCenter, localCenter);

        // Compute local center point after rotation
        const rotatePoint = Communicator.Point3.zero();
        rotationMatrix.transform(localCenter, rotatePoint);

        // Create translation matrix to shift the node arond rotation center after rotation
        const translationMatrix = new Communicator.Matrix();
        translationMatrix.setTranslationComponent(localCenter.x - rotatePoint.x, localCenter.y - rotatePoint.y, localCenter.z - rotatePoint.z);

        // Compute the node matrix of after rotation (multiplyMatrix * translationMatrix)
        const afterMatrix = Communicator.Matrix.multiply(multiplyMatrix, translationMatrix);

        return {
            localAxsis: localAxis,
            localCenter: localCenter,
            afterMatrix: afterMatrix
        };
    }

    // Get a previously created translation channel for a particular Node if it exists
    // Or returns a newly created translation channel for that Node
    _getTranslationChannel(nodeId, startTime) {
        const channelName = `Translate-${nodeId}`;

        // Get existing channel
        let channel = this._channelMap.get(channelName);

        if (!channel) {
            // Create a new channel
            const buffer = new Communicator.Animation.KeyframeBuffer(Communicator.Animation.KeyType.Vec3);
            const sampler = new Communicator.Animation.Sampler(buffer, Communicator.Animation.InterpolationType.Linear);
            channel = this._animation.createNodeChannel(channelName, nodeId, Communicator.Animation.NodeProperty.Translation, sampler);

            this._channelMap.set(channelName, channel);
        }
            
        const translateBuffer = channel.sampler.buffer;

        if (0  == translateBuffer.values.length) {
            // Set initial position
            translateBuffer.appendVec3Keyframe(startTime, this._nodeMatrixes[nodeId].m[12], this._nodeMatrixes[nodeId].m[13], this._nodeMatrixes[nodeId].m[14]);
        }
        else {
            // copy the previous translation keyframe value
            // this prevents any translation value change from time of previous translation keyframe to startTime
            const index = translateBuffer.values.length - translateBuffer.keyOffset;
            translateBuffer.appendVec3Keyframe(startTime, translateBuffer.values[index], translateBuffer.values[index + 1], translateBuffer.values[index + 2]);
        }

        return channel;
    }

    // Get a previously created rotation channel for a particular Node if it exists
    // Or returns a newly created translation channel for that Node
    _getRotationChannel(nodeId, startTime) {
        let channelName = `Rotate-${nodeId}`;

        // Get existing channel
        let channel = this._channelMap.get(channelName);

        if (!channel) {
            // Create a new channel
            const buffer = new Communicator.Animation.KeyframeBuffer(Communicator.Animation.KeyType.Quat);
            const sampler = new Communicator.Animation.Sampler(buffer, Communicator.Animation.InterpolationType.Linear);
            channel = this._animation.createNodeChannel(channelName, nodeId, Communicator.Animation.NodeProperty.Rotation, sampler);
        
            this._channelMap.set(channelName, channel);
        }

        const rotateBuffer = channel.sampler.buffer;

        if (0  == rotateBuffer.values.length) {
            // Set initial rotation
            const rotation = Communicator.Quaternion.createFromMatrix(this._nodeMatrixes[nodeId]);
            rotateBuffer.appendQuatKeyframe(startTime, rotation.x, rotation.y, rotation.z, rotation.w);
        }
        else {
            // copy the previous rotation keyframe value
            // this prevents any rotation value change from time of previous rotation keyframe to startTime
            const index = rotateBuffer.values.length - rotateBuffer.keyOffset;
            rotateBuffer.appendQuatKeyframe(startTime, rotateBuffer.values[index], rotateBuffer.values[index + 1], rotateBuffer.values[index + 2], rotateBuffer.values[index + 3]);
        }

        return channel;
    }

    // You may want to replay the animation
    // Call the 'reload()' function and reset the pause flag state
    rewind() {
        this._player.reload();
        this._isPause = false;
    }

    // Play an animation
    play() {
        this.rewind();
        this._player.play();
    }

    // Toggle the player and pause state
    pause() {
        if (this._isPause) {
            this._player.play();
        }
        else {
            this._player.pause();
        }

        this._isPause = !this._isPause;
    }

    // Translation animation example
    addTranslationAnimation(nodes, startTime, duration, translationVector, translationDistance) {
        for (const nodeId of nodes) {
            // Get initial node matrix
            if (undefined == this._nodeMatrixes[nodeId]) {
                this._nodeMatrixes[nodeId] = this._viewer.model.getNodeMatrix(nodeId);
            }

            // Get previously created translation channel for this nodeId
            // This will create a one if it does not exist yet
            const translateChannel = this._getTranslationChannel(nodeId, startTime);

            // It is also necessary to set initial rotation for the node
            const rotateChannel = this._getRotationChannel(nodeId, startTime);
            
            // Convert the translation vector in the local coordinate 
            const localVector = this._convertLocalVector(nodeId, translationVector);
            localVector.scale(translationDistance);
            
            // Update node matrix and set to buffer
            const transMatrix = new Communicator.Matrix();
            transMatrix.setTranslationComponent(localVector.x, localVector.y, localVector.z);
            const matrix = Communicator.Matrix.multiply(this._nodeMatrixes[nodeId], transMatrix);

            // It is necessary to change setting values by whether the node was lastly rotated
            if (!this._hasRotated[nodeId]) {
                // If it is not rotated, set location from matrix (absolute value)
                translateChannel.sampler.buffer.appendVec3Keyframe(startTime + duration, matrix.m[12], matrix.m[13], matrix.m[14]);
            }
            else {
                // If it is lastly rotated, set incremental value
                translateChannel.sampler.buffer.appendVec3Keyframe(startTime + duration, localVector.x, localVector.y, localVector.z);
            }

            // Store matrix
            this._nodeMatrixes[nodeId] = matrix;

            // Unset the node is lastly rotated 
            this._hasRotated[nodeId] = false;
        }
    }

    addRotationAnimation(nodes, startTime, duration, rotationAxsis, rotationCenter, rotationAngle) {
        for (const nodeId of nodes) {
            // Get initial node matrix
            if (!this._nodeMatrixes[nodeId]) {
                this._nodeMatrixes[nodeId] = this._viewer.model.getNodeMatrix(nodeId);
            }

            // Get previously created rotation channel for this nodeId
            // This will create a one if it does not exist yet
            const rotateChannel = this._getRotationChannel(nodeId, startTime);

            // It is also necessary to set initial translation for the node
            const translateChannel = this._getTranslationChannel(nodeId, startTime);

            // Convert the rotation parameters in the local coordinate
            const localRotation = this._convertLocalRotation(nodeId, this._nodeMatrixes[nodeId], rotationAxsis, rotationCenter, rotationAngle);

            // Set rotation center point as pivotPoints
            this._animation.pivotPoints.set(nodeId, localRotation.localCenter);

            // Set the quaternion axis angle
            const q = Communicator.Quaternion.identity();
            this._setQuatAxisAngle(q, localRotation.localAxsis, Math.PI * rotationAngle / 180);
            rotateChannel.sampler.buffer.appendQuatKeyframe(startTime + duration,  q.x, q.y, q.z, q.w);

            // Update current node matrix
            this._nodeMatrixes[nodeId] = localRotation.afterMatrix;

            // Set true for the node is lastly rotated 
            this._hasRotated[nodeId] = true;
        }
    }

    addCameraAnimation(camera, startTime, duration) {
        // Create channels for each Camera property
        if (!this._channelMap.has("Camera-Position")) {
            // Returns an array of all camera channels with the properties channel.name and channel.type
            const channels = Communicator.Animation.Util.createCameraChannels(this._animation, "Camera", Communicator.Animation.InterpolationType.Linear);

            for (const channel of channels) {
                this._channelMap.set(channel.name, channel);
            }
        }

        // Get current camera from current view
        if (!this._currentCamera) {
            this._currentCamera = this._viewer.view.getCamera();
        }

        // Add initial camera keyframes using a convenience method that will update keyframe buffers for animation channels created with "createCameraChannels()" from above
        Communicator.Animation.Util.keyframeCamera(startTime, this._currentCamera, this._animation);

        // Add destination camera at startTime+duration
        if (0 < duration) {
            Communicator.Animation.Util.keyframeCamera(startTime + duration, camera, this._animation);
        }

        this._currentCamera = camera;
    }

    async addOpacityAnimation(nodes, startTime, duration, opacity) {
        for (const nodeId of nodes) {
            // Get initial node opacity
            if (!this._nodeOpacities[nodeId]) {
                const opacity = await this._viewer.model.getNodesOpacity([nodeId]);

                // Default opacity of 1.0
                if (opacity[0] == null) {
                    this._nodeOpacities[nodeId] = 1.0;
                }
                else {
                    this._nodeOpacities[nodeId] = opacity[0];
                }
            }

            const channelName = `Opacity-${nodeId}`;

            // Get existing channel
            let channel = this._channelMap.get(channelName);

            if (!channel) {
                // Create a new channel
                const buffer = new Communicator.Animation.KeyframeBuffer(Communicator.Animation.KeyType.Scalar);
                const sampler = new Communicator.Animation.Sampler(buffer, Communicator.Animation.InterpolationType.Linear);
                channel = this._animation.createNodeChannel(channelName, nodeId, Communicator.Animation.NodeProperty.Opacity, sampler);

                this._channelMap.set(channelName, channel);
            }

            // Set node opacity
            channel.sampler.buffer.appendScalarKeyframe(startTime, this._nodeOpacities[nodeId]);
            channel.sampler.buffer.appendScalarKeyframe(startTime + duration, opacity);

            // Keep current opacity
            this._nodeOpacities[nodeId] = opacity;
        }
    }

    addVisibilityAnimation(nodes, startTime, duration, visible) {
        for (const nodeId of nodes) {
            // Get initial node visibility
            if (undefined == this._nodeVisibilities[nodeId]) {
                this._nodeVisibilities[nodeId] = this._viewer.model.getNodeVisibility(nodeId);
            }

            const channelName = `Visibility-${nodeId}`;

            // Get existing channel
            let channel = this._channelMap.get(channelName);

            if (!channel) {
                // Create a new channel
                const buffer = new Communicator.Animation.KeyframeBuffer(Communicator.Animation.KeyType.Scalar);
                const sampler = new Communicator.Animation.Sampler(buffer, Communicator.Animation.InterpolationType.Linear);
                channel = this._animation.createNodeChannel(channelName, nodeId, Communicator.Animation.NodeProperty.Visibility, sampler);

                this._channelMap.set(channelName, channel);
            }

            // Set node visibility
            channel.sampler.buffer.appendScalarKeyframe(startTime, this._nodeVisibilities[nodeId] ? 1.0 : 0.0);
            channel.sampler.buffer.appendScalarKeyframe(startTime + duration, visible ? 1.0 : 0.0);

            this._nodeOpacities[nodeId] = visible;
        }

    }

    async addFadeoutAnimation(nodes, startTime, duration) {
        for (const nodeId of nodes) {
            // Change node opacity to 0
            await this.addOpacityAnimation(nodes, startTime, duration, 0);

            // Hide node to enable selection behind objects
            await this.addVisibilityAnimation(nodes, startTime, duration, false);
        }
    }

    async addColorAnimation(nodes, startTime, duration, color) {
        for (const nodeId of nodes) {
            // Get initial node color
            if (!this._nodeColors[nodeId]) {
                const children = this._viewer.model.getNodeChildren(nodeId);

                if (0 == children.length) {
                    const parentNode = this._viewer.model.getNodeParent(nodeId);
                    const color = await this._viewer.model.getNodesEffectiveFaceColor([parentNode]);
                    this._nodeColors[nodeId] = color[0];
                }
                else {
                    const color = await this._viewer.model.getNodesEffectiveFaceColor([nodeId]);
                    this._nodeColors[nodeId] = color[0];
                }
            }

            const channelName = `Color-${nodeId}`;

            // Get existing channel
            let channel = this._channelMap.get(channelName);

            if (!channel) {
                // Create a new channel
                const buffer = new Communicator.Animation.KeyframeBuffer(Communicator.Animation.KeyType.Vec3);
                const sampler = new Communicator.Animation.Sampler(buffer, Communicator.Animation.InterpolationType.Linear);
                channel = this._animation.createNodeChannel(channelName, nodeId, Communicator.Animation.NodeProperty.Color, sampler);

                this._channelMap.set(channelName, channel);
            }

            // Set node color
            channel.sampler.buffer.appendVec3Keyframe(startTime, this._nodeColors[nodeId].r, this._nodeColors[nodeId].g, this._nodeColors[nodeId].b);
            channel.sampler.buffer.appendVec3Keyframe(startTime + duration, color.r, color.g, color.b);

            // Keep current node color
            this._nodeColors[nodeId] = color;
        }
    }

    async addBlinkAnimation(nodes, startTime, duration, color) {
        for (const nodeId of nodes) {
            // Get initial node color
            if (!this._nodeColors[nodeId]) {
                const children = this._viewer.model.getNodeChildren(nodeId);

                if (0 == children.length) {
                    const parentNode = this._viewer.model.getNodeParent(nodeId);
                    const color = await this._viewer.model.getNodesEffectiveFaceColor([parentNode]);
                    this._nodeColors[nodeId] = color[0];
                }
                else {
                    const color = await this._viewer.model.getNodesEffectiveFaceColor([nodeId]);
                    this._nodeColors[nodeId] = color[0];
                }
            }

            const channelName = `Color-${nodeId}`;

            // Get existing channel
            let channel = this._channelMap.get(channelName);

            if (!channel) {
                // Create a new channel
                const buffer = new Communicator.Animation.KeyframeBuffer(Communicator.Animation.KeyType.Vec3);
                const sampler = new Communicator.Animation.Sampler(buffer, Communicator.Animation.InterpolationType.Linear);
                channel = this._animation.createNodeChannel(channelName, nodeId, Communicator.Animation.NodeProperty.Color, sampler);

                this._channelMap.set(channelName, channel);
            }

            // Blink node by changing color
            let numberOfBlinks = 6;
            for (let i = 0; i <= numberOfBlinks; i++) {
                const time = startTime + duration / numberOfBlinks * i;

                if (i % 2 == 0) {
                    channel.sampler.buffer.appendVec3Keyframe(time, this._nodeColors[nodeId].r, this._nodeColors[nodeId].g, this._nodeColors[nodeId].b);
                }
                else {
                    channel.sampler.buffer.appendVec3Keyframe(time, color.r, color.g, color.b);
                }
            }
        }
    }
}