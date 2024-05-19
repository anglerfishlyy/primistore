import fs, { existsSync } from "fs";
import { Application, Request, Response } from "express";
import path from "path";
import multer from "multer";

import {
  PIPE_COMM_DIR,
  getDeviceInfo,
  runScriptInPipe,
} from "../../utils/command-utils.js";
import {
  createPassword,
  createPolicy,
  getPasswordByPassUid,
  getPasswords,
  getPolicies,
  getPolicyById,
  removePasswordByPassUid,
  updatePasswordAES,
  updatePasswordCharset,
} from "./primistore-dao.js";
import {
  encryptWithCharset,
  generateCharset,
} from "../../utils/charset-utils.js";
import { PRIMISTORE_DIR } from "../../utils/path-utils.js";
import { getCurrentTime } from "../../utils/date-utils.js";
import {
  encryptWithAES,
  generateAESKeyIV,
} from "../../utils/encryption-utils.js";
import { CommandOutputType } from "command-executor-lib";
import { Logger } from "winston";

const LOCAL_DIR = process.env.LOCAL_DIR || PRIMISTORE_DIR;

const storage = multer.diskStorage({
  destination: (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void
  ): void => {
    cb(null, PIPE_COMM_DIR);
  },
  filename: (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void
  ): void => {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage: storage });

const passwordCreationHandler = async (
  req: Request,
  res: Response,
  logger: Logger
) => {
  const { identifier, policy_id } = req.body;

  const { key, iv } = generateAESKeyIV();
  if (
    key.type === CommandOutputType.Error ||
    iv.type === CommandOutputType.Error
  ) {
    let errorMessage = key.type == CommandOutputType.Error ? key.value : "";
    errorMessage += iv.type == CommandOutputType.Error ? iv.value : "";
    logger.error(`[${getCurrentTime()}] POST /password : Status 500`);
    res.status(500).send({
      error: errorMessage,
    });
    return;
  }

  const charset = generateCharset();
  const charset_path = path.join(PRIMISTORE_DIR, `charset-${identifier}.txt`);
  fs.writeFileSync(charset_path, charset);

  await createPassword(identifier, key.value, iv.value, policy_id);

  logger.info(`[${getCurrentTime()}] POST /password : Status 200`);
  res.status(200).send({
    status: "success",
  });
};

const getAllPasswordsHandler = async (
  req: Request,
  res: Response,
  logger: Logger
) => {
  const passwords = await getPasswords();
  logger.info(`[${getCurrentTime()}] GET /passwords : Status 200`);
  return res.status(200).send(passwords);
};

const rotateAESKeyIVHandler = async (
  req: Request,
  res: Response,
  logger: Logger
) => {
  const { pass_uid } = req.params;

  const { key, iv } = generateAESKeyIV();
  if (
    key.type === CommandOutputType.Error ||
    iv.type === CommandOutputType.Error
  ) {
    let errorMessage = key.type == CommandOutputType.Error ? key.value : "";
    errorMessage += iv.type == CommandOutputType.Error ? iv.value : "";
    logger.error(
      `[${getCurrentTime()}] PUT /password/aes/${pass_uid} : Status 500`
    );
    res.status(500).send({
      error: errorMessage,
    });
    return;
  }

  const updatedPassword = await updatePasswordAES(
    pass_uid,
    key.value,
    iv.value
  );

  logger.info(
    `[${getCurrentTime()}] PUT /password/aes/${pass_uid} : Status 200`
  );
  res.status(200).send({
    password: updatedPassword,
  });
};

const rotateCharsetHandler = async (
  req: Request,
  res: Response,
  logger: Logger
) => {
  const { pass_uid } = req.params;

  const charsetPath = path.join(PRIMISTORE_DIR, `charset-${pass_uid}.txt`);
  const charset = generateCharset();

  fs.writeFileSync(charsetPath, charset);
  const updatedPassword = await updatePasswordCharset(pass_uid);

  logger.info(
    `[${getCurrentTime()}] PUT /password/charset/${pass_uid} : Status 200`
  );
  res.status(200).send({
    updatedCharset: charset,
    password: updatedPassword,
  });
};

const encryptPasswordHandler = async (
  req: Request,
  res: Response,
  logger: Logger
) => {
  const { pass_uid } = req.params;
  const raw_password = req.body.password;

  const passwordDetails = await getPasswordByPassUid(pass_uid);
  const { aes_key, aes_iv } = passwordDetails;

  let encryptedPassword = encryptWithAES(aes_key, aes_iv, raw_password);
  if (encryptedPassword.type == CommandOutputType.Error) {
    logger.error(
      `[${getCurrentTime()}] POST /password/encrypt/${pass_uid} : Status 500`
    );
    res.status(500).send({
      error: encryptedPassword.value,
    });
    return;
  }

  const charsetPath = path.join(PRIMISTORE_DIR, `charset-${pass_uid}.txt`);
  let charset = fs
    .readFileSync(charsetPath)
    .toString("utf-8")
    .split("\n")
    .slice(0, -1);
  const charsetEncryptedPassword = encryptWithCharset(
    charset,
    encryptedPassword.value
  );

  logger.info(
    `[${getCurrentTime()}] POST /password/encrypt/${pass_uid} : Status 200`
  );
  res.status(200).send({
    encryptedPassword: charsetEncryptedPassword,
  });
};

const deletePasswordHandler = async (
  req: Request,
  res: Response,
  logger: Logger
) => {
  const { pass_uid } = req.params;

  const passwordDetails = await getPasswordByPassUid(pass_uid);
  if (passwordDetails === null) {
    res.status(500).send({
      error: `Could not find password with id ${pass_uid}`,
    });
    return;
  }

  const charsetPath = path.join(LOCAL_DIR, `charset-${pass_uid}.txt`);
  try {
    fs.unlinkSync(charsetPath);
  } catch (err) {
    logger.error(
      `[${getCurrentTime()}] DELETE /password/${pass_uid} : Status 500`
    );
    res.status(500).send({
      error: err.message,
    });
    return;
  }

  const output = await removePasswordByPassUid(pass_uid);

  logger.info(
    `[${getCurrentTime()}] DELETE /password/${pass_uid} : Status 200`
  );
  res.status(200).send({
    status: output.hasOwnProperty("acknowledged")
      ? output["acknowledged"]
      : false,
    pass_uid,
  });
};

const deviceInfoFetchHandler = async (
  req: Request,
  res: Response,
  logger: Logger
) => {
  const deviceInfo = getDeviceInfo();

  logger.info(`[${getCurrentTime()}] GET /device/device-info : Status 200`);
  res.status(200).send({
    info: deviceInfo,
  });
};

const generateBackupHandler = (req: Request, res: Response, logger: Logger) => {
  const password = req.body.password;

  const genBackupOutput = runScriptInPipe("download-backup.sh", password);
  if (genBackupOutput.type === CommandOutputType.Error) {
    logger.error(
      `[${getCurrentTime()}] POST /device/generate-backup : Status 500`
    );
    res.status(500).send({
      error: genBackupOutput.value,
    });
  } else {
    const snapshotName = genBackupOutput.value.trim();
    const snapshotPath = path.join(PIPE_COMM_DIR, snapshotName);
    if (!existsSync(snapshotPath)) {
      logger.error(
        `[${getCurrentTime()}] POST /device/generate-backup : Status 500`
      );
      res.status(500).send({
        error: `Snapshot ${snapshotPath} does not exist!`,
      });
    } else {
      logger.info(
        `[${getCurrentTime()}] POST /device/generate-backup : Status 200`
      );
      res.status(200).send({
        output: snapshotName,
      });
    }
  }
};

const downloadBackupHandler = (req: Request, res: Response, logger: Logger) => {
  const { snapshot_name } = req.params;

  const snapshotPath = path.join(PIPE_COMM_DIR, snapshot_name);
  if (!existsSync(snapshotPath)) {
    logger.error(
      `[${getCurrentTime()}] GET /device/generate-backup/download/${snapshot_name} : Status 500`
    );
    res.status(500).send({
      error: `Snapshot ${snapshot_name} does not exist!`,
    });
  } else {
    res.download(snapshotPath, snapshot_name, (err) => {
      if (err) {
        logger.error(
          `[${getCurrentTime()}] GET /device/generate-backup/download/${snapshot_name} : Status 500`
        );

        // Handle error, for example:
        res.status(500).send({
          message: "Error downloading file",
          error: err,
        });
      } else {
        logger.info(
          `[${getCurrentTime()}] GET /device/generate-backup/download/${snapshot_name} : Status 200`
        );
      }
    });
  }
};

const uploadBackupHandler = (req: Request, res: Response, logger: Logger) => {
  const uploadedFile = req.file;
  const password = req.body.password;
  const uploadedFileName = uploadedFile.filename;
  const uploadBackupOutput = runScriptInPipe("upload-backup.sh", password, [
    uploadedFileName,
  ]);
  if (uploadBackupOutput.type === CommandOutputType.Error) {
    logger.error(
      `[${getCurrentTime()}] POST /device/upload-backup : Status 500`
    );
    res.status(500).send({
      error: uploadBackupOutput.value,
    });
  } else {
    const scriptOutputFileName = uploadBackupOutput.value.trim();
    if (scriptOutputFileName === uploadedFileName.trim()) {
      logger.info(
        `[${getCurrentTime()}] GET /device/upload-backup : Status 200`
      );

      res.status(200).send({
        status: "ok",
      });
    } else {
      logger.error(
        `[${getCurrentTime()}] POST /device/upload-backup : Status 500`
      );
      res.status(500).send({
        error: `Incorrect output from upload: ${uploadedFileName}`,
      });
    }
  }
};

const createPolicyHandler = async (
  req: Request,
  res: Response,
  logger: Logger
) => {
  const { policy_name, update_window_min, update_window_max } = req.body;

  const policy = await createPolicy(
    policy_name,
    update_window_min,
    update_window_max
  );

  logger.info(`[${getCurrentTime()}] POST /policy : Status 200`);
  res.status(200).send({
    policy,
  });
};

const getAllPoliciesHandler = async (
  req: Request,
  res: Response,
  logger: Logger
) => {
  const policies = await getPolicies();
  logger.info(`[${getCurrentTime()}] GET /policy : Status 200`);
  return res.status(200).send(policies);
};

const getPolicyByIdHandler = async (
  req: Request,
  res: Response,
  logger: Logger
) => {
  const { policy_id } = req.params;

  const policy = await getPolicyById(policy_id);
  logger.info(`[${getCurrentTime()}] GET /policy/${policy_id} : Status 200`);
  return res.status(200).send(policy);
};

const PrimistoreController = (app: Application, logger: Logger) => {
  //////////////////////////////////////////
  // Password Endpoints
  //////////////////////////////////////////
  app.post("/password", (req, res) =>
    passwordCreationHandler(req, res, logger)
  );
  app.get("/passwords", (req, res) => getAllPasswordsHandler(req, res, logger));
  app.put("/password/aes/:pass_uid", (req, res) =>
    rotateAESKeyIVHandler(req, res, logger)
  );
  app.put("/password/charset/:pass_uid", (req, res) =>
    rotateCharsetHandler(req, res, logger)
  );
  app.post("/password/encrypt/:pass_uid", (req, res) =>
    encryptPasswordHandler(req, res, logger)
  );
  app.delete("/password/:pass_uid", (req, res) =>
    deletePasswordHandler(req, res, logger)
  );

  //////////////////////////////////////////
  // Device Admin Endpoints
  //////////////////////////////////////////
  app.get("/device/info", (req, res) =>
    deviceInfoFetchHandler(req, res, logger)
  );
  app.post("/device/backup/generate", (req, res) =>
    generateBackupHandler(req, res, logger)
  );
  app.get("/device/backup/download/:snapshot_name", (req, res) =>
    downloadBackupHandler(req, res, logger)
  );
  app.post("/device/backup/upload", upload.single("file"), (req, res) =>
    uploadBackupHandler(req, res, logger)
  );

  //////////////////////////////////////////
  // Policy Endpoints
  //////////////////////////////////////////
  app.post("/policy", (req, res) => createPolicyHandler(req, res, logger));
  app.get("/policy", (req, res) => getAllPoliciesHandler(req, res, logger));
  app.get("/policy/:policy_id", (req, res) =>
    getPolicyByIdHandler(req, res, logger)
  );
};

export default PrimistoreController;
