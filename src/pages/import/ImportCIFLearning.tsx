import { CIFLearningInsights } from "@/components/CIFLearningInsights";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Brain, TrendingUp, Target, Lightbulb } from "lucide-react";

export default function ImportCIFLearning() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Learning Engine</h1>
        <p className="text-muted-foreground">
          Machine learning insights that improve CIF accuracy over time
        </p>
      </div>

      {/* Explainer Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <Brain className="h-8 w-8 text-primary mb-2" />
            <CardTitle className="text-base">Pattern Recognition</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              AI analyzes historical CIF estimates vs actual costs to identify recurring patterns
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <TrendingUp className="h-8 w-8 text-green-600 mb-2" />
            <CardTitle className="text-base">Variance Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Monitors which products consistently over or under-estimate to adjust future calculations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <Target className="h-8 w-8 text-blue-600 mb-2" />
            <CardTitle className="text-base">Adjustment Factors</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Generates product-specific multipliers to improve landed cost predictions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <Lightbulb className="h-8 w-8 text-yellow-600 mb-2" />
            <CardTitle className="text-base">Smart Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Provides actionable suggestions to reduce variance and improve accuracy
            </p>
          </CardContent>
        </Card>
      </div>

      {/* How it Works */}
      <Card>
        <CardHeader>
          <CardTitle>How the Learning Engine Works</CardTitle>
          <CardDescription>
            The CIF Learning Engine continuously improves cost estimation accuracy
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <h4 className="font-medium">Data Collection</h4>
                <p className="text-sm text-muted-foreground">
                  System captures estimated CIF values at order time and actual costs after delivery
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <h4 className="font-medium">Pattern Analysis</h4>
                <p className="text-sm text-muted-foreground">
                  AI identifies systematic over/under-estimates by product, supplier, and season
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <h4 className="font-medium">Adjustment Generation</h4>
                <p className="text-sm text-muted-foreground">
                  Engine produces adjustment factors and recommendations to improve future estimates
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CIF Learning Insights Component */}
      <CIFLearningInsights />
    </div>
  );
}
