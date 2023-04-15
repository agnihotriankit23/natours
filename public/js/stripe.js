/* eslint-disable */
import axios from 'axios';
import { showAlert } from './alert';
const stripe = Stripe(
  'pk_test_51Mx1yuSBbE8aHRMfY7Lsdb4uuabg0ew5RgQ7TVKGinFKVr4E5CwVnGkBlo1m5bec7AQuGp91JHmhO1MVrj9kcxQx003qpTsBQl'
);

export const bookTour = async (tourId) => {
  try {
    // 1) Get checkout session from API
    const session = await axios(
      `http://127.0.0.1:3000/api/v1/booking/checkout-session/${tourId}`
    );
    console.log(session);

    // 2) Create checkout form + chanre credit card
    await stripe.redirectToCheckout({
      sessionId: session.data.session.id,
    });
  } catch (err) {
    console.log(err);
    showAlert('error', err);
  }
};
