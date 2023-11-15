import { createSlice } from "@reduxjs/toolkit";
import {
  createPasswordThunk,
  fetchPasswordsThunk,
  rotateAESKeyAndIVThunk,
  rotateCharsetThunk,
} from "../services/password-thunk";

const initialState = {
  created: false,
  passwords: [],
};

const passwordSlice = createSlice({
  name: "password",
  initialState,
  reducers: {},
  extraReducers: {
    [createPasswordThunk.fulfilled]: (state, action) => {
      alert(action.payload.data.status);
    },
    [fetchPasswordsThunk.fulfilled]: (state, action) => {
      state.passwords = action.payload.data;
    },
    [rotateAESKeyAndIVThunk.fulfilled]: (state, action) => {
      alert("AES Key and IV rotated successfully");
      const updatedPassword = action.payload.data.password;
      for (let i = 0; i < state.passwords.length; i++) {
        if (state.passwords[i].pass_uid === updatedPassword.pass_uid) {
          state.passwords[i].aes_last_rotated =
            updatedPassword.aes_last_rotated;
        }
      }
    },
    [rotateCharsetThunk.fulfilled]: (state, action) => {
      alert("Charset rotated successfully");
      const updatedPassword = action.payload.data.password;
      for (let i = 0; i < state.passwords.length; i++) {
        if (state.passwords[i].pass_uid === updatedPassword.pass_uid) {
          state.passwords[i].charset_last_rotated =
            updatedPassword.charset_last_rotated;
        }
      }
    },
  },
});

export default passwordSlice.reducer;