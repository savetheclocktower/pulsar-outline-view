"use babel";
console.log('runner!');
import { createRunner } from "atom-jasmine3-test-runner";
import { wait } from './async-spec-helpers';

export default createRunner(
  {
    timeReporter: false,
    // specHelper: true
    specHelper: {
      atom: true,
      attachToDom: true,
      ci: true,
      customMatchers: true,
      jasmineFocused: true,
      jasmineJson: false,
      jasminePass: true,
      jasmineTagged: false,
      mockClock: false,
      mockLocalStorage: false,
      profile: false,
      set: false,
      unspy: true
    },
  },
  async () => {
    await wait(500);
  }
);
