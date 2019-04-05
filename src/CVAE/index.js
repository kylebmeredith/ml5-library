// Copyright (c) 2018 ml5
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

/* eslint prefer-destructuring: ["error", {AssignmentExpression: {array: false}}] */
/* eslint no-await-in-loop: "off" */
/*
* CVAE: Run conditional auto-encoder for pro-trained model
*/

import * as tf from '@tensorflow/tfjs';
import callCallback from '../utils/callcallback';

class Cvae {
  // labels should be a set of string represent each labels like labels = ["shirt", "shoes", "bag"]
  constructor(modelPath, callback) {
    this.ready = false;
    this.model = {};
    this.latentDim = Array(16).fill(0);
    // get an array full of zero with the length of labels [0, 0, 0 ...]
    this.modelPath = modelPath;
    this.jsonLoader().then(val => {
      this.ready = callCallback(this.loadCVAEModel(val.model), callback);
      this.labels = val.labels;
      this.labelVector = Array(...{ length: this.labels.length+1 }).map(Function.call, () => 0);
    });
    
  }

  setLatentDim(index, value) {
    for (let i = index; i < this.latentDim.length; i+=2) this.latentDim[i] = value;
  }

  // load tfjs model that is converted by tensorflowjs with graph and weights
  async loadCVAEModel(modelPath) {
    this.model = await tf.loadModel(modelPath);
    return this;
  }

  // label should be a string that you input before at the labels
  async generate(label, callback) {
    return callCallback(this.generateInternal(label), callback);
  }

  getBlob(inputCanvas) {
    return new Promise((resolve, reject) => {
      if (!this.ready) reject();

      inputCanvas.toBlob((blob) => {
        resolve(blob);
      });
    });
  }

  checkP5() {
    if (typeof window !== 'undefined' && window.p5 && this
        && window.p5.Image && typeof window.p5.Image === 'function') return true;
    return false;
  }

  async generateInternal(label) {
    const res = tf.tidy(() => {
      console.log(this.latentDim)
      const params = tf.tensor([this.latentDim]); // 16 latent dims
      const cursor = this.labels.indexOf(label);
      if (cursor < 0) {
        console.log('Wrong input of the label!');
        return [undefined, undefined]; // invalid input just return;
      }

      this.labelVector = this.labelVector.map(() => 0); // clear vector
      this.labelVector[cursor+1] = 1;

      const input = tf.tensor([this.labelVector]);

      const temp = this.model.predict([params, input]);
      return temp.reshape([temp.shape[1], temp.shape[2], temp.shape[3]]);
    });

    const raws = await tf.toPixels(res); // pixel bytes 1.0.2

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const [x, y] = res.shape;
    const imgData = ctx.createImageData(x, y);
    const data = imgData.data;
    for (let i = 0; i < x * y * 4; i += 1) data[i] = raws[i];
    ctx.putImageData(imgData, 0, 0);

    const src = URL.createObjectURL(await this.getBlob(canvas));
    let image;
    if (this.checkP5()) image = window.p5.loadImage(src); 
    return { src, raws, image };
  }

  async jsonLoader() {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', this.modelPath);
      
      xhr.onload = () => {
        const json = JSON.parse(xhr.responseText);
        resolve(json);
      };
      xhr.onerror = (error) => {
        reject(error);
      };
      xhr.send();
    });
  }
}

const CVAE = (model, labels, callback) => new Cvae(model, labels, callback);


export default CVAE;
