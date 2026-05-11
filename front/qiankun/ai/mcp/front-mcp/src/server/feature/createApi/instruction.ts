/**
 * 规范化路径分隔符，确保使用正确的路径分隔符
 * @param path 原始路径
 * @returns 规范化后的路径
 */
function normalizePath(path: string): string {
  // 将正斜杠替换为反斜杠，确保 Windows 环境下的路径一致性
  return path.replace(/\//g, '\\');
}

/**
 * 连接路径部分，使用正确的路径分隔符
 * @param parts 路径部分数组
 * @returns 连接后的路径
 */
function joinPath(...parts: string[]): string {
  // 过滤掉空的部分，然后使用反斜杠连接
  return parts.filter(part => part && part !== '.').join('\\');
}

type CreateApiInstructionTask = {
  type: string;
  filePath?: string;
  description?: string;
  requirements?: string[];
}

type CreateApiInstruction = {
  targetPath?: string;
  tasks: CreateApiInstructionTask[];
  additionalNotes: string[];
  resource?: {
    swaggerData: unknown;
  };
}

/**
 * 构建创建 API 代码的结构化指令
 * @param targetPath 目标文件路径
 * @returns 结构化指令对象
 */
export function buildCreateApiInstruction(targetPath?: string, swaggerData?: any): CreateApiInstruction {
  let instruction: CreateApiInstruction;
  if (targetPath) {
    // 判断 targetPath 是否以 .ts 或 .tsx 结尾
    const isFilePath = targetPath.endsWith('.ts') || targetPath.endsWith('.tsx');

    let directory = targetPath;
    let apiFilePath = targetPath;

    if (isFilePath) {
      // 如果是文件路径，提取目录
      const lastSlashIndex = targetPath.lastIndexOf('/');
      const lastBackslashIndex = targetPath.lastIndexOf('\\');
      const lastSeparatorIndex = Math.max(lastSlashIndex, lastBackslashIndex);

      if (lastSeparatorIndex > -1) {
        directory = targetPath.substring(0, lastSeparatorIndex);
      } else {
        directory = '.';
      }
    } else {
      // 如果是目录路径，确保 API 文件路径有正确的文件名
      apiFilePath = joinPath(targetPath, 'index.ts');
      // directory 保持不变，就是 targetPath 本身
    }

    // 规范化 directory 路径
    directory = normalizePath(directory);

    // 构建结构化指令对象
    instruction = {
      // targetPath: normalizePath(targetPath),
      resource: {
        swaggerData: swaggerData
      },
      tasks: [
        {
          type: 'create_types',
          filePath: joinPath(directory, 'types.ts'),
          description: '创建请求和响应的 TypeScript 类型定义',
          requirements: [
            '只允许创建两个类型定义：一个用于请求参数（如 RequestData），一个用于响应数据（如 ResponseData）',
            '创建的响应数据只对data或者datas(或者类似的属性)类型定义，因为ApiResponse通常是固定的，不需要重新定义',
            '使用合适的 TypeScript 接口或类型别名',
            '添加必要的 JSDoc 注释'
          ]
        },
        {
          type: 'create_api_function',
          filePath: normalizePath(apiFilePath),
          description: '创建 API 调用函数',
          requirements: [
            '函数名应该反映接口功能',
            '包含完整的参数类型',
            '包含返回类型 Promise<T>',
            '使用 fetch 或 axios 进行 HTTP 调用',
            '添加错误处理',
            '包含 JSDoc 注释说明函数用途和参数'
          ]
        },
        {
          type: 'overwrite_or_merge',
          requirements: [
            '往对应的page.json中添加之前接口函数创建的接口函数名称，apiName: "接口函数变量名称"',
          ]
        }
      ],
      additionalNotes: [
        '请根据 Swagger 接口信息生成完整的 TypeScript 代码。如果文件已存在，请更新或合并内容。',
      ]
    };
  } else {
    instruction = {
      tasks: [
        {
          type: 'create_types',
          filePath: 'types.ts',
          description: '创建请求和响应的 TypeScript 类型定义'
        },
        {
          type: 'create_api_function',
          filePath: 'api.ts',
          description: '创建 API 调用函数'
        }
      ],
      additionalNotes: ['请根据接口信息创建 TypeScript 函数和类型定义。']
    };
  }

  return instruction;
}