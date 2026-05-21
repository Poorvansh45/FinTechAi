import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, TrendingUp, TrendingDown, MessageCircle, AlertCircle } from 'lucide-react';

export function DashboardPage() {
  const marketIndices = [
    { name: 'NIFTY 50', value: '23,557.90', change: '+92.30 (0.39%)', status: 'up' },
    { name: 'SENSEX', value: '77,337.59', change: '+131.18 (0.17%)', status: 'up' },
    { name: 'BANKNIFTY', value: '51,703.95', change: '-56.10 (0.11%)', status: 'down' },
    { name: 'NIFTY MIDCAP 100', value: '55,342.30', change: '+256.70 (0.46%)', status: 'up' },
  ];

  const topGainers = [
    { name: 'ADANIPORTS', price: '1,459.70', change: '+3.55%' },
    { name: 'GRASIM', price: '2,516.40', change: '+2.86%' },
    { name: 'ADANIENT', price: '3,189.00', change: '+2.41%' },
    { name: 'CIPLA', price: '1,539.00', change: '+2.21%' },
  ];

  const topLosers = [
    { name: 'KOTAKBANK', price: '1,772.60', change: '-1.45%' },
    { name: 'HDFCBANK', price: '1,658.90', change: '-0.98%' },
    { name: 'ICICIBANK', price: '1,152.00', change: '-0.70%' },
    { name: 'AXISBANK', price: '1,228.00', change: '-0.62%' },
  ];

  const aiInsights = [
      {
          title: "Bullish momentum in IT Sector",
          summary: "AI analysis indicates strong buying interest in major IT stocks ahead of quarterly results.",
          icon: <TrendingUp className="w-5 h-5 text-green-500" />,
          tag: "Sector Analysis"
      },
      {
          title: "Reliance Industries: Key Resistance at ₹3,100",
          summary: "Technical indicators suggest RIL is approaching a critical resistance level. A breakout could lead to a new rally.",
          icon: <AlertCircle className="w-5 h-5 text-yellow-500" />,
          tag: "Stock Alert"
      },
      {
          title: "Quarterly Results Preview: Banking Sector",
          summary: "Our AI model predicts a mixed bag for banking stocks, with private banks likely outperforming PSUs.",
          icon: <MessageCircle className="w-5 h-5 text-blue-500" />,
          tag: "AI Prediction"
      },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {marketIndices.map((index) => (
          <Card key={index.name}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{index.name}</CardTitle>
              {index.status === 'up' ? (
                <ArrowUp className="h-4 w-4 text-green-500" />
              ) : (
                <ArrowDown className="h-4 w-4 text-red-500" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{index.value}</div>
              <p className={`text-xs ${index.status === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                {index.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle>AI-Powered Market Insights</CardTitle>
                <CardDescription>Your daily briefing from FinTechAI.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-4">
                    {aiInsights.map((insight) => (
                        <div key={insight.title} className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="p-2 bg-muted rounded-full">
                                {insight.icon}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-center">
                                    <p className="font-semibold">{insight.title}</p>
                                    <Badge variant="outline" className="text-xs">{insight.tag}</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{insight.summary}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
            <CardFooter>
                <Button variant="outline" size="sm">View All Insights</Button>
            </CardFooter>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" /> Top Gainers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stock</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topGainers.map((stock) => (
                    <TableRow key={stock.name}>
                      <TableCell className="font-medium">{stock.name}</TableCell>
                      <TableCell className="text-right">{stock.price}</TableCell>
                      <TableCell className="text-right text-green-500">{stock.change}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-500" /> Top Losers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stock</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topLosers.map((stock) => (
                    <TableRow key={stock.name}>
                      <TableCell className="font-medium">{stock.name}</TableCell>
                      <TableCell className="text-right">{stock.price}</TableCell>
                      <TableCell className="text-right text-red-500">{stock.change}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
