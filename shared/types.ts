
export type ProjectType = "mobile_app";
export type SourceLanguage = "english" | "urdu" | "roman_urdu";

export type ProjectPlan = {
  projectName: string;
  type: ProjectType;
  framework: string;
  summary: string;
  requirements: string[];
  pages: string[];
  components: string[];
  database: string[];
  apis: string[];
  authenticationRequired: boolean;
  businessRules: string[];
  testingStrategy: string[];
  implementationNotes: string[];
};

export type GeneratedFile = {
  path: string;
  language: string;
  content: string;
  isCritical: boolean;
};

export type ProjectBundle = {
  project: {
    id: number;
    name: string;
    status: string;
    buildStatus: string;
    deployStatus: string;
    updatedAt: string | Date;
  };
  plan: ProjectPlan;
  files: GeneratedFile[];
};

export type ProjectValidation = {
  status: "ready" | "error";
  checkedFiles: number;
  errors: string[];
  warnings: string[];
};


