import { useState } from 'react';
import { ChevronDown, ChevronRight, Shield, ShieldCheck, ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface Permission {
  role: string;
  resource: string;
  can_view: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
}

interface ResourceCategory {
  name: string;
  resources: string[];
}

interface RolePermissionCardProps {
  role: string;
  permissions: Permission[];
  allResources: string[];
  resourceCategories: ResourceCategory[];
  onPermissionChange: (role: string, resource: string, field: string, value: boolean) => void;
  isAdmin?: boolean;
}

export function RolePermissionCard({
  role,
  permissions,
  allResources,
  resourceCategories,
  onPermissionChange,
  isAdmin = false,
}: RolePermissionCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getPermission = (resource: string): Permission => {
    return permissions.find(p => p.resource === resource) || {
      role,
      resource,
      can_view: false,
      can_create: false,
      can_update: false,
      can_delete: false
    };
  };

  // Count enabled resources (at least one permission)
  const enabledResources = allResources.filter(resource => {
    const perm = getPermission(resource);
    return perm.can_view || perm.can_create || perm.can_update || perm.can_delete;
  }).length;

  // Count total permissions
  const totalPermissions = allResources.reduce((count, resource) => {
    const perm = getPermission(resource);
    return count + (perm.can_view ? 1 : 0) + (perm.can_create ? 1 : 0) + 
           (perm.can_update ? 1 : 0) + (perm.can_delete ? 1 : 0);
  }, 0);

  const maxPermissions = allResources.length * 4;
  const permissionPercentage = Math.round((totalPermissions / maxPermissions) * 100);

  const handleToggleAll = (action: 'view' | 'create' | 'update' | 'delete', enable: boolean) => {
    allResources.forEach(resource => {
      const field = `can_${action}`;
      onPermissionChange(role, resource, field, enable);
    });
  };

  const roleDescriptions: Record<string, string> = {
    admin: 'Full system access - all permissions granted',
    manager: 'Operations management with broad access',
    management: 'Senior management with oversight capabilities',
    driver: 'Delivery operations and route management',
    production: 'Production floor operations',
    accounting: 'Financial and billing access',
    logistics: 'Supply chain and inventory management',
    hr: 'Human resources and employee management',
    interim: 'Temporary staff with limited access',
  };

  return (
    <Card className={cn(
      "transition-all duration-200",
      isOpen && "ring-2 ring-primary/20"
    )}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              {isOpen ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
              <div className="flex items-center gap-2">
                {isAdmin ? (
                  <ShieldCheck className="h-5 w-5 text-primary" />
                ) : enabledResources > 0 ? (
                  <Shield className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ShieldX className="h-5 w-5 text-muted-foreground/50" />
                )}
                <div>
                  <h3 className="font-semibold capitalize text-lg">{role}</h3>
                  <p className="text-sm text-muted-foreground">
                    {roleDescriptions[role] || 'Custom role'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge 
                variant={enabledResources === allResources.length ? "default" : enabledResources > 0 ? "secondary" : "outline"}
                className="font-mono"
              >
                {enabledResources}/{allResources.length} resources
              </Badge>
              <div className="w-24 h-2 bg-muted rounded-full overflow-hidden hidden sm:block">
                <div 
                  className={cn(
                    "h-full transition-all duration-300",
                    permissionPercentage === 100 ? "bg-primary" : 
                    permissionPercentage > 50 ? "bg-primary/70" : 
                    permissionPercentage > 0 ? "bg-primary/40" : "bg-muted"
                  )}
                  style={{ width: `${permissionPercentage}%` }}
                />
              </div>
            </div>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 space-y-4">
            {isAdmin ? (
              <div className="p-4 bg-primary/10 rounded-lg text-center">
                <ShieldCheck className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="font-medium">Admin has full access</p>
                <p className="text-sm text-muted-foreground">
                  Admins automatically have all permissions and cannot be restricted.
                </p>
              </div>
            ) : (
              <>
                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg">
                  <span className="text-sm font-medium mr-2">Quick toggle:</span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleToggleAll('view', true)}
                  >
                    Enable All View
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleToggleAll('view', false)}
                  >
                    Disable All View
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      allResources.forEach(resource => {
                        onPermissionChange(role, resource, 'can_view', true);
                        onPermissionChange(role, resource, 'can_create', true);
                        onPermissionChange(role, resource, 'can_update', true);
                        onPermissionChange(role, resource, 'can_delete', true);
                      });
                    }}
                  >
                    Enable All
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      allResources.forEach(resource => {
                        onPermissionChange(role, resource, 'can_view', false);
                        onPermissionChange(role, resource, 'can_create', false);
                        onPermissionChange(role, resource, 'can_update', false);
                        onPermissionChange(role, resource, 'can_delete', false);
                      });
                    }}
                  >
                    Disable All
                  </Button>
                </div>

                {/* Permission Categories */}
                <div className="space-y-4">
                  {resourceCategories.map(category => {
                    const categoryResources = category.resources.filter(r => allResources.includes(r));
                    if (categoryResources.length === 0) return null;
                    
                    return (
                      <div key={category.name} className="space-y-2">
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                          {category.name}
                        </h4>
                        <div className="grid gap-2">
                          {categoryResources.map(resource => {
                            const perm = getPermission(resource);
                            const hasAnyPermission = perm.can_view || perm.can_create || perm.can_update || perm.can_delete;
                            
                            return (
                              <div 
                                key={resource}
                                className={cn(
                                  "flex items-center justify-between p-3 rounded-lg border transition-colors",
                                  hasAnyPermission ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-transparent"
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <Checkbox
                                    checked={hasAnyPermission}
                                    onCheckedChange={(checked) => {
                                      const value = checked as boolean;
                                      onPermissionChange(role, resource, 'can_view', value);
                                      if (!value) {
                                        onPermissionChange(role, resource, 'can_create', false);
                                        onPermissionChange(role, resource, 'can_update', false);
                                        onPermissionChange(role, resource, 'can_delete', false);
                                      }
                                    }}
                                  />
                                  <span className="font-medium capitalize">
                                    {resource.replace(/_/g, ' ')}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4">
                                  <label className="flex items-center gap-1.5 text-sm">
                                    <Checkbox
                                      checked={perm.can_view}
                                      onCheckedChange={(checked) => 
                                        onPermissionChange(role, resource, 'can_view', checked as boolean)
                                      }
                                    />
                                    <span className="text-muted-foreground">View</span>
                                  </label>
                                  <label className="flex items-center gap-1.5 text-sm">
                                    <Checkbox
                                      checked={perm.can_create}
                                      onCheckedChange={(checked) => 
                                        onPermissionChange(role, resource, 'can_create', checked as boolean)
                                      }
                                    />
                                    <span className="text-muted-foreground">Create</span>
                                  </label>
                                  <label className="flex items-center gap-1.5 text-sm">
                                    <Checkbox
                                      checked={perm.can_update}
                                      onCheckedChange={(checked) => 
                                        onPermissionChange(role, resource, 'can_update', checked as boolean)
                                      }
                                    />
                                    <span className="text-muted-foreground">Update</span>
                                  </label>
                                  <label className="flex items-center gap-1.5 text-sm">
                                    <Checkbox
                                      checked={perm.can_delete}
                                      onCheckedChange={(checked) => 
                                        onPermissionChange(role, resource, 'can_delete', checked as boolean)
                                      }
                                    />
                                    <span className="text-muted-foreground">Delete</span>
                                  </label>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}