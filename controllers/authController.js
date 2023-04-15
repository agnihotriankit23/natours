const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { promisify } = require('util');
const AppError = require('../utils/appError');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const Email = require('../utils/email');
//const { log } = require('console');

const signInToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const createSendToken = (user, statusCode, res) => {
  const token = signInToken(user._id);

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),

    httpOnly: true, //for https
  };

  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;

  res.cookie('jwt', token, cookieOptions);

  //Remove the password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.signUp = catchAsync(async (req, res, next) => {
  const newUser = await User.create(req.body);

  const url = `${req.protocol}://${req.get('host')}/me`;
  // console.log(url);

  //await new Email(newUser, url).sendWelcome();

  createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  //1) Check email and password exist
  if (!email || !password) {
    return next(new AppError('Please Provide email and Password', 400));
  }

  //2)Check user exist and password is correct!
  const user = await User.findOne({ email }).select('+password');
  const correct = await user.correctPassword(password, user.password);

  if (!user || !correct) {
    return next(new AppError('Email or password is wrong', 400));
  }

  //3)If everything is okay then sent token to client.
  createSendToken(user, 200, res);
});

exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({
    status: 'success',
  });
};

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check of it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(
      new AppError('You are not logged in! Please log in to get access.', 401)
    );
  }

  // 2) Verification token
  // console.log('Token Verifying.....');
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  //console.log('Token Verified...');
  //3)Check if user still exists
  const currentUser = await User.findById(decoded.id);

  if (!currentUser) {
    //console.log('Current User does not exist!');
    return next(
      new AppError(
        'The user belonging to this token does no longer exist.',
        401
      )
    );
  }
  //4)check if user changed the password after token generation
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError(
        'User Recently Changed the password! Please Login Agian',
        401
      )
    );
  }

  //Grant Access to Protected Route
  req.user = currentUser; // Because of this line we can use req.user.id
  res.locals.user = currentUser;
  next();
});

exports.isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      // 1) Verification token
      // console.log('Token Verifying.....');
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET
      );
      //console.log('Token Verified...');
      //2)Check if user still exists
      const currentUser = await User.findById(decoded.id);
      //console.log('-----------------', currentUser);
      // console.log(typeof currentUser, !currentUser, null === false);
      if (!currentUser) {
        //console.log('Current User does not exist!');
        return next();
      }
      //4)check if user changed the password after token generation
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next();
      }
      //console.log('Token pass hogya');
      //Grant Access to Protected Route
      res.locals.user = currentUser; // Because of this line we can use req.user.id
      return next();
    } catch (err) {
      return next();
    }
  }
  next();
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles ['admin', 'lead-guide']. role='user'
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }

    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  //1)Get user based on POSTed Email address
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return next(new AppError('There is no registerd user with email ID', 404));
  }

  //2)Generate the random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  //3)Send it to users email

  try {
    const resetURL = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/users/resetPassword/${resetToken}`;

    await new Email(user, resetURL).sendPasswordReset();

    res.status(200).json({
      status: 'Success',
      message: 'Token sent to email',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError(
        'There is an Error with sending email! Please try after some time.',
        500
      )
    );
  }
});
exports.resetPassword = catchAsync(async (req, res, next) => {
  //1) Get user based on the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });
  //2)If token has not expired and there is user then set new Password
  if (!user) {
    return next(new AppError('Token is invalid or expired!', 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetExpires = undefined;
  user.passwordResetToken = undefined;
  await user.save();

  //3)Update changePassword Property for the user
  //4)Log the user in, Send JWT
  createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  //1) Get user from collection
  const user = await User.findById(req.user.id).select('+password');
  //2) Check is POSTed current password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Your current Password is wrong', 404));
  }
  //3) If so update Password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save('');

  createSendToken(user, 200, res);
});
