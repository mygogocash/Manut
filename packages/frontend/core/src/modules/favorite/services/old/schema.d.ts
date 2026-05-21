import { z } from 'zod';
export declare const TagOptionSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    color: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    color: string;
    name: string;
}, {
    id: string;
    color: string;
    name: string;
}>;
export type TagOption = z.infer<typeof TagOptionSchema>;
export declare enum PageSystemPropertyId {
    Tags = "tags",
    Journal = "journal"
}
export declare enum PagePropertyType {
    Text = "text",
    Number = "number",
    Date = "date",
    Progress = "progress",
    Checkbox = "checkbox",
    Tags = "tags",
    CreatedBy = "createdBy",
    UpdatedBy = "updatedBy"
}
export declare const PagePropertyMetaBaseSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    source: z.ZodString;
    type: z.ZodNativeEnum<typeof PagePropertyType>;
    icon: z.ZodString;
    required: z.ZodOptional<z.ZodBoolean>;
    readonly: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    id: string;
    type: PagePropertyType;
    icon: string;
    name: string;
    source: string;
    required?: boolean | undefined;
    readonly?: boolean | undefined;
}, {
    id: string;
    type: PagePropertyType;
    icon: string;
    name: string;
    source: string;
    required?: boolean | undefined;
    readonly?: boolean | undefined;
}>;
export declare const PageSystemPropertyMetaBaseSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    type: z.ZodNativeEnum<typeof PagePropertyType>;
    icon: z.ZodString;
    required: z.ZodOptional<z.ZodBoolean>;
    readonly: z.ZodOptional<z.ZodBoolean>;
} & {
    source: z.ZodLiteral<"system">;
}, "strip", z.ZodTypeAny, {
    id: string;
    type: PagePropertyType;
    icon: string;
    name: string;
    source: "system";
    required?: boolean | undefined;
    readonly?: boolean | undefined;
}, {
    id: string;
    type: PagePropertyType;
    icon: string;
    name: string;
    source: "system";
    required?: boolean | undefined;
    readonly?: boolean | undefined;
}>;
export declare const PageCustomPropertyMetaSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    type: z.ZodNativeEnum<typeof PagePropertyType>;
    icon: z.ZodString;
    required: z.ZodOptional<z.ZodBoolean>;
    readonly: z.ZodOptional<z.ZodBoolean>;
} & {
    source: z.ZodLiteral<"custom">;
    order: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    type: PagePropertyType;
    order: number;
    icon: string;
    name: string;
    source: "custom";
    required?: boolean | undefined;
    readonly?: boolean | undefined;
}, {
    id: string;
    type: PagePropertyType;
    order: number;
    icon: string;
    name: string;
    source: "custom";
    required?: boolean | undefined;
    readonly?: boolean | undefined;
}>;
export declare const PageInfoItemSchema: z.ZodObject<{
    id: z.ZodString;
    visibility: z.ZodEnum<["visible", "hide", "hide-if-empty"]>;
    value: z.ZodAny;
}, "strip", z.ZodTypeAny, {
    id: string;
    visibility: "visible" | "hide" | "hide-if-empty";
    value?: any;
}, {
    id: string;
    visibility: "visible" | "hide" | "hide-if-empty";
    value?: any;
}>;
export declare const PageInfoJournalItemSchema: z.ZodObject<{
    visibility: z.ZodEnum<["visible", "hide", "hide-if-empty"]>;
} & {
    id: z.ZodLiteral<PageSystemPropertyId.Journal>;
    value: z.ZodUnion<[z.ZodString, z.ZodLiteral<false>]>;
}, "strip", z.ZodTypeAny, {
    id: PageSystemPropertyId.Journal;
    value: string | false;
    visibility: "visible" | "hide" | "hide-if-empty";
}, {
    id: PageSystemPropertyId.Journal;
    value: string | false;
    visibility: "visible" | "hide" | "hide-if-empty";
}>;
export declare const PageInfoTagsItemSchema: z.ZodObject<{
    visibility: z.ZodEnum<["visible", "hide", "hide-if-empty"]>;
} & {
    id: z.ZodLiteral<PageSystemPropertyId.Tags>;
    value: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    id: PageSystemPropertyId.Tags;
    value: string[];
    visibility: "visible" | "hide" | "hide-if-empty";
}, {
    id: PageSystemPropertyId.Tags;
    value: string[];
    visibility: "visible" | "hide" | "hide-if-empty";
}>;
export type PageInfoTagsItem = z.infer<typeof PageInfoTagsItemSchema>;
export declare const WorkspaceFavoriteItemSchema: z.ZodObject<{
    id: z.ZodString;
    order: z.ZodString;
    type: z.ZodEnum<["doc", "collection"]>;
    value: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    id: string;
    type: "doc" | "collection";
    value: boolean;
    order: string;
}, {
    id: string;
    type: "doc" | "collection";
    value: boolean;
    order: string;
}>;
export type WorkspaceFavoriteItem = z.infer<typeof WorkspaceFavoriteItemSchema>;
declare const PageInfoCustomPropertyItemSchema: z.ZodObject<{
    id: z.ZodString;
    visibility: z.ZodEnum<["visible", "hide", "hide-if-empty"]>;
    value: z.ZodAny;
} & {
    order: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    order: string;
    visibility: "visible" | "hide" | "hide-if-empty";
    value?: any;
}, {
    id: string;
    order: string;
    visibility: "visible" | "hide" | "hide-if-empty";
    value?: any;
}>;
declare const WorkspacePagePropertiesSchema: z.ZodObject<{
    custom: z.ZodRecord<z.ZodString, z.ZodObject<{
        id: z.ZodString;
        visibility: z.ZodEnum<["visible", "hide", "hide-if-empty"]>;
        value: z.ZodAny;
    } & {
        order: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        order: string;
        visibility: "visible" | "hide" | "hide-if-empty";
        value?: any;
    }, {
        id: string;
        order: string;
        visibility: "visible" | "hide" | "hide-if-empty";
        value?: any;
    }>>;
    system: z.ZodObject<{
        journal: z.ZodObject<{
            visibility: z.ZodEnum<["visible", "hide", "hide-if-empty"]>;
        } & {
            id: z.ZodLiteral<PageSystemPropertyId.Journal>;
            value: z.ZodUnion<[z.ZodString, z.ZodLiteral<false>]>;
        }, "strip", z.ZodTypeAny, {
            id: PageSystemPropertyId.Journal;
            value: string | false;
            visibility: "visible" | "hide" | "hide-if-empty";
        }, {
            id: PageSystemPropertyId.Journal;
            value: string | false;
            visibility: "visible" | "hide" | "hide-if-empty";
        }>;
        tags: z.ZodObject<{
            visibility: z.ZodEnum<["visible", "hide", "hide-if-empty"]>;
        } & {
            id: z.ZodLiteral<PageSystemPropertyId.Tags>;
            value: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            id: PageSystemPropertyId.Tags;
            value: string[];
            visibility: "visible" | "hide" | "hide-if-empty";
        }, {
            id: PageSystemPropertyId.Tags;
            value: string[];
            visibility: "visible" | "hide" | "hide-if-empty";
        }>;
    }, "strip", z.ZodTypeAny, {
        tags: {
            id: PageSystemPropertyId.Tags;
            value: string[];
            visibility: "visible" | "hide" | "hide-if-empty";
        };
        journal: {
            id: PageSystemPropertyId.Journal;
            value: string | false;
            visibility: "visible" | "hide" | "hide-if-empty";
        };
    }, {
        tags: {
            id: PageSystemPropertyId.Tags;
            value: string[];
            visibility: "visible" | "hide" | "hide-if-empty";
        };
        journal: {
            id: PageSystemPropertyId.Journal;
            value: string | false;
            visibility: "visible" | "hide" | "hide-if-empty";
        };
    }>;
}, "strip", z.ZodTypeAny, {
    system: {
        tags: {
            id: PageSystemPropertyId.Tags;
            value: string[];
            visibility: "visible" | "hide" | "hide-if-empty";
        };
        journal: {
            id: PageSystemPropertyId.Journal;
            value: string | false;
            visibility: "visible" | "hide" | "hide-if-empty";
        };
    };
    custom: Record<string, {
        id: string;
        order: string;
        visibility: "visible" | "hide" | "hide-if-empty";
        value?: any;
    }>;
}, {
    system: {
        tags: {
            id: PageSystemPropertyId.Tags;
            value: string[];
            visibility: "visible" | "hide" | "hide-if-empty";
        };
        journal: {
            id: PageSystemPropertyId.Journal;
            value: string | false;
            visibility: "visible" | "hide" | "hide-if-empty";
        };
    };
    custom: Record<string, {
        id: string;
        order: string;
        visibility: "visible" | "hide" | "hide-if-empty";
        value?: any;
    }>;
}>;
export declare const WorkspaceAffinePropertiesSchema: z.ZodObject<{
    schema: z.ZodOptional<z.ZodObject<{
        pageProperties: z.ZodObject<{
            custom: z.ZodRecord<z.ZodString, z.ZodObject<{
                id: z.ZodString;
                name: z.ZodString;
                type: z.ZodNativeEnum<typeof PagePropertyType>;
                icon: z.ZodString;
                required: z.ZodOptional<z.ZodBoolean>;
                readonly: z.ZodOptional<z.ZodBoolean>;
            } & {
                source: z.ZodLiteral<"custom">;
                order: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                id: string;
                type: PagePropertyType;
                order: number;
                icon: string;
                name: string;
                source: "custom";
                required?: boolean | undefined;
                readonly?: boolean | undefined;
            }, {
                id: string;
                type: PagePropertyType;
                order: number;
                icon: string;
                name: string;
                source: "custom";
                required?: boolean | undefined;
                readonly?: boolean | undefined;
            }>>;
            system: z.ZodObject<{
                journal: z.ZodObject<{
                    name: z.ZodString;
                    icon: z.ZodString;
                    required: z.ZodOptional<z.ZodBoolean>;
                    readonly: z.ZodOptional<z.ZodBoolean>;
                    source: z.ZodLiteral<"system">;
                } & {
                    id: z.ZodLiteral<PageSystemPropertyId.Journal>;
                    type: z.ZodLiteral<PagePropertyType.Date>;
                }, "strip", z.ZodTypeAny, {
                    id: PageSystemPropertyId.Journal;
                    type: PagePropertyType.Date;
                    icon: string;
                    name: string;
                    source: "system";
                    required?: boolean | undefined;
                    readonly?: boolean | undefined;
                }, {
                    id: PageSystemPropertyId.Journal;
                    type: PagePropertyType.Date;
                    icon: string;
                    name: string;
                    source: "system";
                    required?: boolean | undefined;
                    readonly?: boolean | undefined;
                }>;
                tags: z.ZodObject<{
                    name: z.ZodString;
                    source: z.ZodString;
                    icon: z.ZodString;
                    required: z.ZodOptional<z.ZodBoolean>;
                    readonly: z.ZodOptional<z.ZodBoolean>;
                } & {
                    id: z.ZodLiteral<PageSystemPropertyId.Tags>;
                    type: z.ZodLiteral<PagePropertyType.Tags>;
                    options: z.ZodArray<z.ZodObject<{
                        id: z.ZodString;
                        name: z.ZodString;
                        color: z.ZodString;
                    }, "strip", z.ZodTypeAny, {
                        id: string;
                        color: string;
                        name: string;
                    }, {
                        id: string;
                        color: string;
                        name: string;
                    }>, "many">;
                }, "strip", z.ZodTypeAny, {
                    id: PageSystemPropertyId.Tags;
                    options: {
                        id: string;
                        color: string;
                        name: string;
                    }[];
                    type: PagePropertyType.Tags;
                    icon: string;
                    name: string;
                    source: string;
                    required?: boolean | undefined;
                    readonly?: boolean | undefined;
                }, {
                    id: PageSystemPropertyId.Tags;
                    options: {
                        id: string;
                        color: string;
                        name: string;
                    }[];
                    type: PagePropertyType.Tags;
                    icon: string;
                    name: string;
                    source: string;
                    required?: boolean | undefined;
                    readonly?: boolean | undefined;
                }>;
            }, "strip", z.ZodTypeAny, {
                tags: {
                    id: PageSystemPropertyId.Tags;
                    options: {
                        id: string;
                        color: string;
                        name: string;
                    }[];
                    type: PagePropertyType.Tags;
                    icon: string;
                    name: string;
                    source: string;
                    required?: boolean | undefined;
                    readonly?: boolean | undefined;
                };
                journal: {
                    id: PageSystemPropertyId.Journal;
                    type: PagePropertyType.Date;
                    icon: string;
                    name: string;
                    source: "system";
                    required?: boolean | undefined;
                    readonly?: boolean | undefined;
                };
            }, {
                tags: {
                    id: PageSystemPropertyId.Tags;
                    options: {
                        id: string;
                        color: string;
                        name: string;
                    }[];
                    type: PagePropertyType.Tags;
                    icon: string;
                    name: string;
                    source: string;
                    required?: boolean | undefined;
                    readonly?: boolean | undefined;
                };
                journal: {
                    id: PageSystemPropertyId.Journal;
                    type: PagePropertyType.Date;
                    icon: string;
                    name: string;
                    source: "system";
                    required?: boolean | undefined;
                    readonly?: boolean | undefined;
                };
            }>;
        }, "strip", z.ZodTypeAny, {
            system: {
                tags: {
                    id: PageSystemPropertyId.Tags;
                    options: {
                        id: string;
                        color: string;
                        name: string;
                    }[];
                    type: PagePropertyType.Tags;
                    icon: string;
                    name: string;
                    source: string;
                    required?: boolean | undefined;
                    readonly?: boolean | undefined;
                };
                journal: {
                    id: PageSystemPropertyId.Journal;
                    type: PagePropertyType.Date;
                    icon: string;
                    name: string;
                    source: "system";
                    required?: boolean | undefined;
                    readonly?: boolean | undefined;
                };
            };
            custom: Record<string, {
                id: string;
                type: PagePropertyType;
                order: number;
                icon: string;
                name: string;
                source: "custom";
                required?: boolean | undefined;
                readonly?: boolean | undefined;
            }>;
        }, {
            system: {
                tags: {
                    id: PageSystemPropertyId.Tags;
                    options: {
                        id: string;
                        color: string;
                        name: string;
                    }[];
                    type: PagePropertyType.Tags;
                    icon: string;
                    name: string;
                    source: string;
                    required?: boolean | undefined;
                    readonly?: boolean | undefined;
                };
                journal: {
                    id: PageSystemPropertyId.Journal;
                    type: PagePropertyType.Date;
                    icon: string;
                    name: string;
                    source: "system";
                    required?: boolean | undefined;
                    readonly?: boolean | undefined;
                };
            };
            custom: Record<string, {
                id: string;
                type: PagePropertyType;
                order: number;
                icon: string;
                name: string;
                source: "custom";
                required?: boolean | undefined;
                readonly?: boolean | undefined;
            }>;
        }>;
    }, "strip", z.ZodTypeAny, {
        pageProperties: {
            system: {
                tags: {
                    id: PageSystemPropertyId.Tags;
                    options: {
                        id: string;
                        color: string;
                        name: string;
                    }[];
                    type: PagePropertyType.Tags;
                    icon: string;
                    name: string;
                    source: string;
                    required?: boolean | undefined;
                    readonly?: boolean | undefined;
                };
                journal: {
                    id: PageSystemPropertyId.Journal;
                    type: PagePropertyType.Date;
                    icon: string;
                    name: string;
                    source: "system";
                    required?: boolean | undefined;
                    readonly?: boolean | undefined;
                };
            };
            custom: Record<string, {
                id: string;
                type: PagePropertyType;
                order: number;
                icon: string;
                name: string;
                source: "custom";
                required?: boolean | undefined;
                readonly?: boolean | undefined;
            }>;
        };
    }, {
        pageProperties: {
            system: {
                tags: {
                    id: PageSystemPropertyId.Tags;
                    options: {
                        id: string;
                        color: string;
                        name: string;
                    }[];
                    type: PagePropertyType.Tags;
                    icon: string;
                    name: string;
                    source: string;
                    required?: boolean | undefined;
                    readonly?: boolean | undefined;
                };
                journal: {
                    id: PageSystemPropertyId.Journal;
                    type: PagePropertyType.Date;
                    icon: string;
                    name: string;
                    source: "system";
                    required?: boolean | undefined;
                    readonly?: boolean | undefined;
                };
            };
            custom: Record<string, {
                id: string;
                type: PagePropertyType;
                order: number;
                icon: string;
                name: string;
                source: "custom";
                required?: boolean | undefined;
                readonly?: boolean | undefined;
            }>;
        };
    }>>;
    favorites: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        id: z.ZodString;
        order: z.ZodString;
        type: z.ZodEnum<["doc", "collection"]>;
        value: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        id: string;
        type: "doc" | "collection";
        value: boolean;
        order: string;
    }, {
        id: string;
        type: "doc" | "collection";
        value: boolean;
        order: string;
    }>>>;
    pageProperties: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        custom: z.ZodRecord<z.ZodString, z.ZodObject<{
            id: z.ZodString;
            visibility: z.ZodEnum<["visible", "hide", "hide-if-empty"]>;
            value: z.ZodAny;
        } & {
            order: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            order: string;
            visibility: "visible" | "hide" | "hide-if-empty";
            value?: any;
        }, {
            id: string;
            order: string;
            visibility: "visible" | "hide" | "hide-if-empty";
            value?: any;
        }>>;
        system: z.ZodObject<{
            journal: z.ZodObject<{
                visibility: z.ZodEnum<["visible", "hide", "hide-if-empty"]>;
            } & {
                id: z.ZodLiteral<PageSystemPropertyId.Journal>;
                value: z.ZodUnion<[z.ZodString, z.ZodLiteral<false>]>;
            }, "strip", z.ZodTypeAny, {
                id: PageSystemPropertyId.Journal;
                value: string | false;
                visibility: "visible" | "hide" | "hide-if-empty";
            }, {
                id: PageSystemPropertyId.Journal;
                value: string | false;
                visibility: "visible" | "hide" | "hide-if-empty";
            }>;
            tags: z.ZodObject<{
                visibility: z.ZodEnum<["visible", "hide", "hide-if-empty"]>;
            } & {
                id: z.ZodLiteral<PageSystemPropertyId.Tags>;
                value: z.ZodArray<z.ZodString, "many">;
            }, "strip", z.ZodTypeAny, {
                id: PageSystemPropertyId.Tags;
                value: string[];
                visibility: "visible" | "hide" | "hide-if-empty";
            }, {
                id: PageSystemPropertyId.Tags;
                value: string[];
                visibility: "visible" | "hide" | "hide-if-empty";
            }>;
        }, "strip", z.ZodTypeAny, {
            tags: {
                id: PageSystemPropertyId.Tags;
                value: string[];
                visibility: "visible" | "hide" | "hide-if-empty";
            };
            journal: {
                id: PageSystemPropertyId.Journal;
                value: string | false;
                visibility: "visible" | "hide" | "hide-if-empty";
            };
        }, {
            tags: {
                id: PageSystemPropertyId.Tags;
                value: string[];
                visibility: "visible" | "hide" | "hide-if-empty";
            };
            journal: {
                id: PageSystemPropertyId.Journal;
                value: string | false;
                visibility: "visible" | "hide" | "hide-if-empty";
            };
        }>;
    }, "strip", z.ZodTypeAny, {
        system: {
            tags: {
                id: PageSystemPropertyId.Tags;
                value: string[];
                visibility: "visible" | "hide" | "hide-if-empty";
            };
            journal: {
                id: PageSystemPropertyId.Journal;
                value: string | false;
                visibility: "visible" | "hide" | "hide-if-empty";
            };
        };
        custom: Record<string, {
            id: string;
            order: string;
            visibility: "visible" | "hide" | "hide-if-empty";
            value?: any;
        }>;
    }, {
        system: {
            tags: {
                id: PageSystemPropertyId.Tags;
                value: string[];
                visibility: "visible" | "hide" | "hide-if-empty";
            };
            journal: {
                id: PageSystemPropertyId.Journal;
                value: string | false;
                visibility: "visible" | "hide" | "hide-if-empty";
            };
        };
        custom: Record<string, {
            id: string;
            order: string;
            visibility: "visible" | "hide" | "hide-if-empty";
            value?: any;
        }>;
    }>>>;
    favoritesMigrated: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    schema?: {
        pageProperties: {
            system: {
                tags: {
                    id: PageSystemPropertyId.Tags;
                    options: {
                        id: string;
                        color: string;
                        name: string;
                    }[];
                    type: PagePropertyType.Tags;
                    icon: string;
                    name: string;
                    source: string;
                    required?: boolean | undefined;
                    readonly?: boolean | undefined;
                };
                journal: {
                    id: PageSystemPropertyId.Journal;
                    type: PagePropertyType.Date;
                    icon: string;
                    name: string;
                    source: "system";
                    required?: boolean | undefined;
                    readonly?: boolean | undefined;
                };
            };
            custom: Record<string, {
                id: string;
                type: PagePropertyType;
                order: number;
                icon: string;
                name: string;
                source: "custom";
                required?: boolean | undefined;
                readonly?: boolean | undefined;
            }>;
        };
    } | undefined;
    favorites?: Record<string, {
        id: string;
        type: "doc" | "collection";
        value: boolean;
        order: string;
    }> | undefined;
    pageProperties?: Record<string, {
        system: {
            tags: {
                id: PageSystemPropertyId.Tags;
                value: string[];
                visibility: "visible" | "hide" | "hide-if-empty";
            };
            journal: {
                id: PageSystemPropertyId.Journal;
                value: string | false;
                visibility: "visible" | "hide" | "hide-if-empty";
            };
        };
        custom: Record<string, {
            id: string;
            order: string;
            visibility: "visible" | "hide" | "hide-if-empty";
            value?: any;
        }>;
    }> | undefined;
    favoritesMigrated?: boolean | undefined;
}, {
    schema?: {
        pageProperties: {
            system: {
                tags: {
                    id: PageSystemPropertyId.Tags;
                    options: {
                        id: string;
                        color: string;
                        name: string;
                    }[];
                    type: PagePropertyType.Tags;
                    icon: string;
                    name: string;
                    source: string;
                    required?: boolean | undefined;
                    readonly?: boolean | undefined;
                };
                journal: {
                    id: PageSystemPropertyId.Journal;
                    type: PagePropertyType.Date;
                    icon: string;
                    name: string;
                    source: "system";
                    required?: boolean | undefined;
                    readonly?: boolean | undefined;
                };
            };
            custom: Record<string, {
                id: string;
                type: PagePropertyType;
                order: number;
                icon: string;
                name: string;
                source: "custom";
                required?: boolean | undefined;
                readonly?: boolean | undefined;
            }>;
        };
    } | undefined;
    favorites?: Record<string, {
        id: string;
        type: "doc" | "collection";
        value: boolean;
        order: string;
    }> | undefined;
    pageProperties?: Record<string, {
        system: {
            tags: {
                id: PageSystemPropertyId.Tags;
                value: string[];
                visibility: "visible" | "hide" | "hide-if-empty";
            };
            journal: {
                id: PageSystemPropertyId.Journal;
                value: string | false;
                visibility: "visible" | "hide" | "hide-if-empty";
            };
        };
        custom: Record<string, {
            id: string;
            order: string;
            visibility: "visible" | "hide" | "hide-if-empty";
            value?: any;
        }>;
    }> | undefined;
    favoritesMigrated?: boolean | undefined;
}>;
export type PageInfoCustomPropertyMeta = z.infer<typeof PageCustomPropertyMetaSchema>;
export type WorkspaceAffineProperties = z.infer<typeof WorkspaceAffinePropertiesSchema>;
export type PageInfoCustomProperty = z.infer<typeof PageInfoCustomPropertyItemSchema>;
export type WorkspaceAffinePageProperties = z.infer<typeof WorkspacePagePropertiesSchema>;
export {};
//# sourceMappingURL=schema.d.ts.map