import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 データベースのシード処理を開始します...');

  // 既存データをクリア
  await prisma.oAuthState.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.session.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.employeeRole.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.employee.deleteMany();

  console.log('✅ 既存データをクリアしました');

  // 役割マスタの作成
  const roles = await Promise.all([
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
  ]);

  console.log('✅ 役割マスタを作成しました');

  // 権限マスタの作成
  const permissions = await Promise.all([
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
  ]);

  console.log('✅ 権限マスタを作成しました');

  // 役割と権限の紐付け
  const rolePermissionMap = {
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

  for (const [roleCode, permissionCodes] of Object.entries(rolePermissionMap)) {
    const role = roles.find(r => r.roleCode === roleCode);
    const rolePermissions = permissions.filter(p => permissionCodes.includes(p.permissionCode));
    
    for (const permission of rolePermissions) {
      await prisma.rolePermission.create({
        data: {
          roleId: role!.id,
          permissionId: permission.id,
        },
      });
    }
  }

  console.log('✅ 役割と権限の紐付けを作成しました');

  // テスト用従業員の作成
  const employees = await Promise.all([
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
  ]);

  console.log('✅ テスト用従業員を作成しました');

  // 従業員に役割を割り当て
  await prisma.employeeRole.create({
    data: {
      employeeId: employees[0].id,
      roleId: roles.find(r => r.roleCode === 'SUPER_ADMIN')!.id,
    },
  });

  await prisma.employeeRole.create({
    data: {
      employeeId: employees[1].id,
      roleId: roles.find(r => r.roleCode === 'MANAGER')!.id,
    },
  });

  await prisma.employeeRole.create({
    data: {
      employeeId: employees[2].id,
      roleId: roles.find(r => r.roleCode === 'EMPLOYEE')!.id,
    },
  });

  console.log('✅ 従業員に役割を割り当てました');

  console.log('🎉 シード処理が完了しました！');
  
  // 作成したデータのサマリーを表示
  const employeeCount = await prisma.employee.count();
  const roleCount = await prisma.role.count();
  const permissionCount = await prisma.permission.count();
  
  console.log(`
  作成されたデータ:
  - 従業員: ${employeeCount}人
  - 役割: ${roleCount}種類
  - 権限: ${permissionCount}種類
  
  テストアカウント:
  - admin@example.com (システム管理者)
  - manager@example.com (マネージャー)
  - employee@example.com (一般従業員)
  `);
}

main()
  .catch((e) => {
    console.error('❌ シード処理でエラーが発生しました:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });