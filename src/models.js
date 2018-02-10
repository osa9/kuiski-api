class BaseModel {
    constructor(params) {
        this.params = params;
    }

    static fromObject(obj) {
        const values = this.PARAMS.map((param) => {
            if(!obj.hasOwnProperty(param)) {
                throw TypeError(`Object must has propetery: ${param}`, 'models.js');
            }
    
            return obj[param];
        });

        return new this.CLASS(...values);
    }

    static fromString(str) {
        return this.fromObject(JSON.parse(str));
    }

    toJSON() {
        const res = {};
        this.params.forEach((param) => {
            res[param] = this[param];
        });

        return res;
    }

    toString() {
        return JSON.stringify(this.toJSON());
    }
}

exports.User = class User extends BaseModel{
    static get PARAMS() {
        return ['id', 'name', 'icon', 'debt'];
    }

    static get CLASS() {
        return User;
    }

    constructor(id, name, icon, debt) {
        super(User.PARAMS);

        this.id = id;
        this.name = name;
        this.icon = icon;
        this.debt = debt;
    }
}

exports.NotifyMessage = class NotifyMessage extends BaseModel {
    static get PARAMS() {
        return ['type', 'message'];
    }

    static get CLASS() {
        return NotifyMessage;
    }

    constructor(type, message) {
        super(NotifyMessage.PARAMS);

        this.type = type;
        this.message = message;
    }

    static fromObject(obj) {
        return factory(NotifyMessage, PARAMS, obj);
    }

    static Text(message) {
        return new NotifyMessage('text', message);
    }

    static Debt(userId, currentDebt, newDebt) {
        return new NotifyMessage('debt', JSON.stringify({
            userId: userId,
            currentDebt: currentDebt,
            newDebt: newDebt
        }));
    }

    static Audio(url) {
        return new NotifyMessage('audio', url);
    }

    static Image(url) {
        return new NotifyMessage('image', url);
    }

    static Video(url) {
        return new NotifyMessage('image', url);
    }
}