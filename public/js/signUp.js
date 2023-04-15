/* eslint-disable */
import axios from 'axios';
import { showAlert } from './alert';

export const signup = async (data) => {
  try {
    console.log(data);
    const res = await axios({
      method: 'POST',
      url: '/api/v1/users/signup',
      data,
    });

    if (res.data.status === 'success') {
      showAlert('success', 'Sign Up  succesfully');
      window.setTimeout(() => {
        location.assign('/login');
      }, 1500);
    }
  } catch (err) {
    showAlert('error', err.response.data.message);
    window.setTimeout(() => {
      location.reload();
    }, 1500);
  }
};
