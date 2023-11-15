import { createAsyncThunk } from "@reduxjs/toolkit";

import * as passwordService from "./password-service";

export const createPasswordThunk = createAsyncThunk(
  "password/createPassword",
  async (payload) => {
    const response = await passwordService.createPassword(payload.identifier);
    return response;
  }
);

export const fetchPasswordsThunk = createAsyncThunk(
  "password/fetchPasswords",
  async () => {
    const response = await passwordService.fetchPasswords();
    return response;
  }
);

export const rotateAESKeyAndIVThunk = createAsyncThunk(
  "password/rotateAESKeyAndIV",
  async (payload) => {
    const response = await passwordService.rotateAESKeyAndIV(payload.passUid);
    return response;
  }
);

export const rotateCharsetThunk = createAsyncThunk(
  "password/rotateCharset",
  async (payload) => {
    const response = await passwordService.rotateCharset(payload.passUid);
    return response;
  }
);