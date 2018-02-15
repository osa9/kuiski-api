"use strict";

const get = (hash, key, defaultValue = undefined) => {
  if (hash[key] === null || hash[key] === undefined) {
    return defaultValue;
  }

  return hash[key];
};

class HttpError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

class BadRequestError extends HttpError {
  constructor(message) {
    super(message, 400);
  }
}

class NotFoundError extends HttpError {
  constructor(message) {
    super(message, 404);
  }
}

class ConflictError extends HttpError {
  constructor(message) {
    super(message, 409);
  }
}

class InternalServerError extends HttpError {
  constructor(message) {
    super(message, 503);
  }
}

class ApiRequestHandler {
  constructor(params, event, context) {
    this.params = params;
    this.event = event;
    this.context = context;
  }

  /*getParameter(name, default_value = null, target = ['pathParameters', 'queryStringParameters']) {
        for (let t in target) {
            const params = this.event['p'];
            if (params && name in params) {
                return params[name];
            }
        }

        return default_value;
    }*/
}

class LambdaApi {
  constructor(event, context, callback) {
    this.event = event;
    this.context = context;
    this.callback = callback;
    this.headers = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    };
  }

  setHeader(key, value) {
    if (value != null) {
      this.headers[key] = value;
    } else {
      this.headers.delte(key);
    }
  }

  setParameters(params) {
    this.params = params;
  }

  _response(statusCode, body) {
    return {
      statusCode: statusCode.toString(),
      body: JSON.stringify(body),
      headers: this.headers
    };
  }

  _buildHttpResponse(err, res) {
    if (err) {
      const code = "code" in err ? err.code : 503;
      const response = { message: err.message };
      if (process.env.DEBUG) {
        response.fileName = err.fileName;
        response.lineNumber = err.lineNumber;
        response.stack = err.stack;
      }
      return this._response(code, response);
    }

    return this._response(200, res);
  }

  _getTarget(target, name) {
    switch (target) {
      case "env":
        return process.env;
      case "path":
        return get(this.event, "pathParameters", {});
      case "query":
        return get(this.event, "queryStringParameters", {});
      case "body":
        var res = {};
        res[name] = this.event.body;
        return res;
      default:
        throw new InternalServerError(`target "${target}" does not exists`);
    }
  }

  _convert(value, type) {
    if (value === null || type == "string") {
      return value; // Do nothing
    }

    if (type == "integer") {
      const n = Number(value);
      if (Number.isNaN(n)) {
        return n;
      } else {
        return n;
      }
    }

    if (type === "json") {
      console.log("json");
      console.log(value);
      return JSON.parse(value);
    }

    if (typeof type === "function") {
      if ("fromString" in type) {
        return type.fromString(value);
      }

      return type(value);
    }

    throw new InternalServerError(`Unknown type: "${type}"`);
  }

  getParameters(paramDefinitions) {
    var errors = [];
    var result = {};

    Object.keys(paramDefinitions).forEach(defKey => {
      const def = paramDefinitions[defKey];
      const target = this._getTarget(def.in, def.name);

      if (!(def.name in target) && def.required) {
        errors.push(
          `Parameter Error: Mandatory parameter ${def.name} is missing`
        );
        return null;
      }

      const rawValue = get(target, def.name, get(def, "default", null));
      const value = this._convert(rawValue, def.type);
      if (value === undefined) {
        errors.push(
          `Validation Error: Parameter "${def.name}" does not match type "${
            def.type
          }"`
        );
      }

      result[def.name] = value;
    });

    if (errors.length > 0) {
      throw new BadRequestError(errors.join("\n"));
    }

    return result;
  }

  execute(handler) {
    new Promise(resolve => {
      const params = this.params ? this.getParameters(this.params) : undefined;
      const res = handler(
        new ApiRequestHandler(params, this.event, this.context)
      );
      resolve(res);
    })
      .then(res => {
        this.callback(null, this._buildHttpResponse(null, res));
      })
      .catch(err => {
        console.log(err);
        this.callback(null, this._buildHttpResponse(err, null));
      });
  }
}

const defineParam = (target, name, required, type, defaultValue = null) => {
  return {
    in: target,
    name: name,
    required: required,
    type: type,
    default: defaultValue
  };
};

module.exports = {
  LambdaApi: LambdaApi,
  HttpError: HttpError,
  BadRequestError: BadRequestError,
  NotFoundError: NotFoundError,
  InternalServerError: InternalServerError,
  ConflictError: ConflictError,
  defineParam: defineParam
};
