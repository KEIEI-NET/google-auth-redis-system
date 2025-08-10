"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("@prisma/client");
var prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var roles, permissions, rolePermissionMap, _loop_1, _i, _a, _b, roleCode, permissionCodes, employees, employeeCount, roleCount, permissionCount;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    console.log('🌱 データベースのシード処理を開始します...');
                    // 既存データをクリア
                    return [4 /*yield*/, prisma.oAuthState.deleteMany()];
                case 1:
                    // 既存データをクリア
                    _c.sent();
                    return [4 /*yield*/, prisma.auditLog.deleteMany()];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, prisma.session.deleteMany()];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, prisma.refreshToken.deleteMany()];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, prisma.rolePermission.deleteMany()];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, prisma.employeeRole.deleteMany()];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, prisma.permission.deleteMany()];
                case 7:
                    _c.sent();
                    return [4 /*yield*/, prisma.role.deleteMany()];
                case 8:
                    _c.sent();
                    return [4 /*yield*/, prisma.employee.deleteMany()];
                case 9:
                    _c.sent();
                    console.log('✅ 既存データをクリアしました');
                    return [4 /*yield*/, Promise.all([
                            prisma.role.create({
                                data: {
                                    roleCode: 'SUPER_ADMIN',
                                    roleName: 'システム管理者',
                                    description: 'システム全体の管理権限を持つ最高権限者',
                                    priority: 100,
                                },
                            }),
                            prisma.role.create({
                                data: {
                                    roleCode: 'ADMIN',
                                    roleName: '管理者',
                                    description: 'ユーザー管理やシステム設定を行う管理者',
                                    priority: 80,
                                },
                            }),
                            prisma.role.create({
                                data: {
                                    roleCode: 'MANAGER',
                                    roleName: 'マネージャー',
                                    description: '部署やチームの管理を行うマネージャー',
                                    priority: 60,
                                },
                            }),
                            prisma.role.create({
                                data: {
                                    roleCode: 'EMPLOYEE',
                                    roleName: '一般従業員',
                                    description: '通常の業務を行う一般従業員',
                                    priority: 40,
                                },
                            }),
                            prisma.role.create({
                                data: {
                                    roleCode: 'VIEWER',
                                    roleName: '閲覧者',
                                    description: 'データの閲覧のみ可能な権限',
                                    priority: 20,
                                },
                            }),
                        ])];
                case 10:
                    roles = _c.sent();
                    console.log('✅ 役割マスタを作成しました');
                    return [4 /*yield*/, Promise.all([
                            // ユーザー管理権限
                            prisma.permission.create({
                                data: {
                                    permissionCode: 'USER_CREATE',
                                    permissionName: 'ユーザー作成',
                                    description: '新規ユーザーを作成する権限',
                                    resource: 'users',
                                    action: 'create',
                                },
                            }),
                            prisma.permission.create({
                                data: {
                                    permissionCode: 'USER_READ',
                                    permissionName: 'ユーザー閲覧',
                                    description: 'ユーザー情報を閲覧する権限',
                                    resource: 'users',
                                    action: 'read',
                                },
                            }),
                            prisma.permission.create({
                                data: {
                                    permissionCode: 'USER_UPDATE',
                                    permissionName: 'ユーザー更新',
                                    description: 'ユーザー情報を更新する権限',
                                    resource: 'users',
                                    action: 'update',
                                },
                            }),
                            prisma.permission.create({
                                data: {
                                    permissionCode: 'USER_DELETE',
                                    permissionName: 'ユーザー削除',
                                    description: 'ユーザーを削除する権限',
                                    resource: 'users',
                                    action: 'delete',
                                },
                            }),
                            // 権限管理
                            prisma.permission.create({
                                data: {
                                    permissionCode: 'ROLE_MANAGE',
                                    permissionName: '権限管理',
                                    description: '役割と権限を管理する権限',
                                    resource: 'roles',
                                    action: 'manage',
                                },
                            }),
                            // データ管理権限
                            prisma.permission.create({
                                data: {
                                    permissionCode: 'DATA_EDIT',
                                    permissionName: 'データ編集',
                                    description: 'データを編集する権限',
                                    resource: 'data',
                                    action: 'edit',
                                },
                            }),
                            prisma.permission.create({
                                data: {
                                    permissionCode: 'DATA_VIEW',
                                    permissionName: 'データ閲覧',
                                    description: 'データを閲覧する権限',
                                    resource: 'data',
                                    action: 'view',
                                },
                            }),
                            // レポート権限
                            prisma.permission.create({
                                data: {
                                    permissionCode: 'REPORT_CREATE',
                                    permissionName: 'レポート作成',
                                    description: 'レポートを作成する権限',
                                    resource: 'reports',
                                    action: 'create',
                                },
                            }),
                            prisma.permission.create({
                                data: {
                                    permissionCode: 'REPORT_VIEW',
                                    permissionName: 'レポート閲覧',
                                    description: 'レポートを閲覧する権限',
                                    resource: 'reports',
                                    action: 'view',
                                },
                            }),
                        ])];
                case 11:
                    permissions = _c.sent();
                    console.log('✅ 権限マスタを作成しました');
                    rolePermissionMap = {
                        SUPER_ADMIN: [
                            'USER_CREATE', 'USER_READ', 'USER_UPDATE', 'USER_DELETE',
                            'ROLE_MANAGE', 'DATA_EDIT', 'DATA_VIEW', 'REPORT_CREATE', 'REPORT_VIEW'
                        ],
                        ADMIN: [
                            'USER_CREATE', 'USER_READ', 'USER_UPDATE', 'USER_DELETE',
                            'DATA_EDIT', 'DATA_VIEW', 'REPORT_CREATE', 'REPORT_VIEW'
                        ],
                        MANAGER: [
                            'USER_READ', 'DATA_EDIT', 'DATA_VIEW', 'REPORT_CREATE', 'REPORT_VIEW'
                        ],
                        EMPLOYEE: [
                            'DATA_VIEW', 'REPORT_VIEW'
                        ],
                        VIEWER: [
                            'DATA_VIEW', 'REPORT_VIEW'
                        ],
                    };
                    _loop_1 = function (roleCode, permissionCodes) {
                        var role, rolePermissions, _d, rolePermissions_1, permission;
                        return __generator(this, function (_e) {
                            switch (_e.label) {
                                case 0:
                                    role = roles.find(function (r) { return r.roleCode === roleCode; });
                                    rolePermissions = permissions.filter(function (p) { return permissionCodes.includes(p.permissionCode); });
                                    _d = 0, rolePermissions_1 = rolePermissions;
                                    _e.label = 1;
                                case 1:
                                    if (!(_d < rolePermissions_1.length)) return [3 /*break*/, 4];
                                    permission = rolePermissions_1[_d];
                                    return [4 /*yield*/, prisma.rolePermission.create({
                                            data: {
                                                roleId: role.id,
                                                permissionId: permission.id,
                                            },
                                        })];
                                case 2:
                                    _e.sent();
                                    _e.label = 3;
                                case 3:
                                    _d++;
                                    return [3 /*break*/, 1];
                                case 4: return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, _a = Object.entries(rolePermissionMap);
                    _c.label = 12;
                case 12:
                    if (!(_i < _a.length)) return [3 /*break*/, 15];
                    _b = _a[_i], roleCode = _b[0], permissionCodes = _b[1];
                    return [5 /*yield**/, _loop_1(roleCode, permissionCodes)];
                case 13:
                    _c.sent();
                    _c.label = 14;
                case 14:
                    _i++;
                    return [3 /*break*/, 12];
                case 15:
                    console.log('✅ 役割と権限の紐付けを作成しました');
                    return [4 /*yield*/, Promise.all([
                            prisma.employee.create({
                                data: {
                                    employeeId: 'EMP001',
                                    email: 'admin@example.com',
                                    firstName: '太郎',
                                    lastName: '管理',
                                    department: 'システム部',
                                    position: 'システム管理者',
                                    hireDate: new Date('2020-04-01'),
                                    isActive: true,
                                },
                            }),
                            prisma.employee.create({
                                data: {
                                    employeeId: 'EMP002',
                                    email: 'manager@example.com',
                                    firstName: '花子',
                                    lastName: '山田',
                                    department: '営業部',
                                    position: '部長',
                                    hireDate: new Date('2018-04-01'),
                                    isActive: true,
                                },
                            }),
                            prisma.employee.create({
                                data: {
                                    employeeId: 'EMP003',
                                    email: 'employee@example.com',
                                    firstName: '次郎',
                                    lastName: '鈴木',
                                    department: '営業部',
                                    position: '一般社員',
                                    hireDate: new Date('2022-04-01'),
                                    isActive: true,
                                },
                            }),
                        ])];
                case 16:
                    employees = _c.sent();
                    console.log('✅ テスト用従業員を作成しました');
                    // 従業員に役割を割り当て
                    return [4 /*yield*/, prisma.employeeRole.create({
                            data: {
                                employeeId: employees[0].id,
                                roleId: roles.find(function (r) { return r.roleCode === 'SUPER_ADMIN'; }).id,
                            },
                        })];
                case 17:
                    // 従業員に役割を割り当て
                    _c.sent();
                    return [4 /*yield*/, prisma.employeeRole.create({
                            data: {
                                employeeId: employees[1].id,
                                roleId: roles.find(function (r) { return r.roleCode === 'MANAGER'; }).id,
                            },
                        })];
                case 18:
                    _c.sent();
                    return [4 /*yield*/, prisma.employeeRole.create({
                            data: {
                                employeeId: employees[2].id,
                                roleId: roles.find(function (r) { return r.roleCode === 'EMPLOYEE'; }).id,
                            },
                        })];
                case 19:
                    _c.sent();
                    console.log('✅ 従業員に役割を割り当てました');
                    console.log('🎉 シード処理が完了しました！');
                    return [4 /*yield*/, prisma.employee.count()];
                case 20:
                    employeeCount = _c.sent();
                    return [4 /*yield*/, prisma.role.count()];
                case 21:
                    roleCount = _c.sent();
                    return [4 /*yield*/, prisma.permission.count()];
                case 22:
                    permissionCount = _c.sent();
                    console.log("\n  \u4F5C\u6210\u3055\u308C\u305F\u30C7\u30FC\u30BF:\n  - \u5F93\u696D\u54E1: ".concat(employeeCount, "\u4EBA\n  - \u5F79\u5272: ").concat(roleCount, "\u7A2E\u985E\n  - \u6A29\u9650: ").concat(permissionCount, "\u7A2E\u985E\n  \n  \u30C6\u30B9\u30C8\u30A2\u30AB\u30A6\u30F3\u30C8:\n  - admin@example.com (\u30B7\u30B9\u30C6\u30E0\u7BA1\u7406\u8005)\n  - manager@example.com (\u30DE\u30CD\u30FC\u30B8\u30E3\u30FC)\n  - employee@example.com (\u4E00\u822C\u5F93\u696D\u54E1)\n  "));
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .catch(function (e) {
    console.error('❌ シード処理でエラーが発生しました:', e);
    process.exit(1);
})
    .finally(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, prisma.$disconnect()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
