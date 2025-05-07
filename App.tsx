import { useState, ChangeEvent, FormEvent, useRef } from 'react';
import './App.css';
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PrinterIcon } from 'lucide-react'; // Ícone para impressão

interface FormData {
  objetivoPrincipal?: string;
  nivelAtividade?: string;
  peso?: string;
  altura?: string;
  idade?: string;
  restricaoAlimentar?: string;
  outraRestricao?: string;
  alimentoIndispensavel?: string;
}

interface MealDetail {
  calories: number;
  suggestion: string;
  time: string;
}

interface PlannerResult {
  dailyCalories: number;
  waterIntake: number;
  meals: {
    [key: string]: MealDetail; // Para permitir dias da semana no futuro
    cafeDaManha: MealDetail;
    almoco: MealDetail;
    lancheTarde: MealDetail;
    jantar: MealDetail;
  };
  formDataSnapshot: FormData;
  // Adicionar campo para o planner semanal completo se necessário
  weeklyPlan?: { [day: string]: { meals: { [mealName: string]: MealDetail } } };
}

const TOTAL_STEPS = 7; // Objetivo, Atividade, Peso, Altura, Idade, Restrição, Indispensável

// --- Funções de Cálculo (mantidas como antes, mas podem ser movidas para utils.ts) ---
const calcularTMB = (peso: number, altura: number, idade: number): number => {
  return (10 * peso) + (6.25 * altura) - (5 * idade) - 78; // Média Mifflin-St Jeor
};

const calcularCaloriasAtividade = (tmb: number, nivelAtividade?: string): number => {
  let fatorAtividade = 1.2;
  switch (nivelAtividade) {
    case "levemente_ativo": fatorAtividade = 1.375; break;
    case "ativo": fatorAtividade = 1.55; break;
    case "muito_ativo": fatorAtividade = 1.725; break;
    default: fatorAtividade = 1.2; break;
  }
  return tmb * fatorAtividade;
};

const ajustarCaloriasObjetivo = (caloriasBase: number, objetivoPrincipal?: string): number => {
  switch (objetivoPrincipal) {
    case "perder_peso": return caloriasBase - 500;
    case "ganhar_massa":
    case "ganhar_peso": return caloriasBase + 300; // Ajustado para ganho mais gradual
    default: return caloriasBase;
  }
};

const calcularAgua = (peso: number): number => {
  return Math.round(peso * 35);
};

// --- Sugestões de Refeições (simplificado, idealmente viria de um banco de dados/lógica mais complexa) ---
const mealSuggestions: { [key: string]: string[] } = {
  cafeDaManha: [
    "Iogurte natural com frutas e granola",
    "Ovos mexidos com pão integral e uma fruta",
    "Vitamina de frutas com aveia e sementes de chia",
    "Tapioca com queijo branco e tomate",
    "Panqueca de banana com aveia e canela"
  ],
  almoco: [
    "Salada colorida com frango grelhado e quinoa",
    "Peixe assado com batata doce e legumes no vapor",
    "Lentilha com arroz integral e salada de folhas verdes",
    "Carne moída com purê de mandioquinha e brócolis",
    "Wrap integral com atum, vegetais e homus"
  ],
  lancheTarde: [
    "Mix de castanhas e uma fruta",
    "Iogurte com mel e nozes",
    "Palitos de cenoura e pepino com pasta de amendoim",
    "Biscoito de arroz com abacate e tomate cereja",
    "Uma porção de frutas secas (damasco, ameixa)"
  ],
  jantar: [
    "Sopa de legumes com croutons integrais",
    "Omelete com cogumelos e salada",
    "Salmão grelhado com aspargos e arroz selvagem",
    "Frango desfiado com legumes salteados",
    "Creme de abóbora com gengibre e sementes de girassol"
  ]
};

const getRandomSuggestion = (mealType: string, restrictions?: string, preferences?: string): string => {
  const suggestions = mealSuggestions[mealType] || ["Opção padrão para esta refeição."];
  let suggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
  // Lógica básica para incorporar restrições/preferências (muito simplificada)
  if (restrictions && restrictions !== "nenhuma" && restrictions !== "outras") {
    suggestion += ` (Atenção: ${restrictions})`;
  }
  if (preferences) {
    suggestion += ` (Lembre-se de: ${preferences})`;
  }
  return suggestion;
};

const gerarPlanoAlimentar = (data: FormData): PlannerResult | null => {
  const peso = parseFloat(data.peso || "0");
  const altura = parseFloat(data.altura || "0");
  const idade = parseInt(data.idade || "0", 10);

  if (!peso || !altura || !idade || !data.nivelAtividade || !data.objetivoPrincipal) {
    alert("Por favor, preencha todos os campos obrigatórios para gerar o plano.");
    return null;
  }

  const tmb = calcularTMB(peso, altura, idade);
  const caloriasComAtividade = calcularCaloriasAtividade(tmb, data.nivelAtividade);
  const dailyCalories = ajustarCaloriasObjetivo(caloriasComAtividade, data.objetivoPrincipal);
  const waterIntake = calcularAgua(peso);

  const mealDistribution = {
    cafeDaManha: 0.25,
    almoco: 0.35,
    lancheTarde: 0.15,
    jantar: 0.25
  };

  const meals: PlannerResult['meals'] = {
    cafeDaManha: { calories: 0, suggestion: '', time: "08:00" },
    almoco: { calories: 0, suggestion: '', time: "12:30" },
    lancheTarde: { calories: 0, suggestion: '', time: "16:00" },
    jantar: { calories: 0, suggestion: '', time: "19:30" }
  };

  let weeklyPlan: PlannerResult['weeklyPlan'] = {};
  const daysOfWeek = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];

  daysOfWeek.forEach(day => {
    weeklyPlan[day] = { meals: {} };
    for (const mealType in mealDistribution) {
      const mealCalories = dailyCalories * (mealDistribution as any)[mealType];
      const suggestion = getRandomSuggestion(mealType, data.restricaoAlimentar === "outras" ? data.outraRestricao : data.restricaoAlimentar, data.alimentoIndispensavel);
      const time = (meals as any)[mealType].time; // Pega o horário padrão
      
      (weeklyPlan[day].meals as any)[mealType] = {
        calories: Math.round(mealCalories),
        suggestion: suggestion,
        time: time
      };
      // Para o resumo do primeiro dia (ou um dia típico)
      if (day === "Segunda-feira") {
        (meals as any)[mealType] = { calories: Math.round(mealCalories), suggestion, time };
      }
    }
  });

  return {
    dailyCalories: Math.round(dailyCalories),
    waterIntake,
    meals, // Refeições de um dia típico para resumo
    weeklyPlan, // Plano semanal completo
    formDataSnapshot: data,
  };
};
// --- Fim Funções de Cálculo ---

function App() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({});
  const [plannerData, setPlannerData] = useState<PlannerResult | null>(null);
  const plannerRef = useRef<HTMLDivElement>(null);

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePrint = () => {
    const printContents = plannerRef.current?.innerHTML;
    const originalContents = document.body.innerHTML;
    if (printContents) {
      // Criar um iframe temporário para impressão
      const iframe = document.createElement('iframe');
      iframe.style.height = '0px';
      iframe.style.width = '0px';
      iframe.style.position = 'absolute';
      document.body.appendChild(iframe);
      
      const iframeDoc = iframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(`
          <html>
            <head>
              <title>Plano Alimentar</title>
              <style>
                body { font-family: sans-serif; margin: 20px; }
                .print-header { text-align: center; margin-bottom: 20px; }
                .print-header h1 { color: #166534; /* green-700 */ }
                .print-header p { color: #2563eb; /* blue-600 */ }
                .print-card { border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 15px; padding: 15px; page-break-inside: avoid; }
                .print-card-title { font-size: 1.1em; font-weight: bold; color: #15803d; /* green-600 */ margin-bottom: 5px; }
                .print-card-desc { font-size: 0.9em; color: #6b7280; margin-bottom: 10px; }
                .print-meal-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
                .print-day-title { font-size: 1.3em; color: #166534; margin-top: 20px; margin-bottom: 10px; border-bottom: 2px solid #d1d5db; padding-bottom: 5px; }
                .print-water-calories { text-align: center; margin-bottom: 20px; font-size: 1.1em; }
                .print-water-calories span { font-weight: bold; }
                .print-footer { text-align: center; margin-top: 30px; font-size: 0.8em; color: #6b7280; }
              </style>
            </head>
            <body>
              <div class="print-header">
                <h1>Planner Alimentar Inteligente</h1>
                <p>Seu plano alimentar personalizado.</p>
              </div>
              ${printContents}
              <div class="print-footer">
                <p>&copy; ${new Date().getFullYear()} Planner Alimentar Inteligente. Desenvolvido por Manus.</p>
                <p>Este é um protótipo. As informações geradas são apenas para demonstração.</p>
              </div>
            </body>
          </html>
        `);
        iframeDoc.close();
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        document.body.removeChild(iframe); // Limpar após impressão
      } else {
        // Fallback para window.print se o iframe falhar
        document.body.innerHTML = printContents;
        window.print();
        document.body.innerHTML = originalContents;
        window.location.reload(); // Recarregar para restaurar scripts e estilos
      }
    } else {
        // Fallback mais simples se plannerRef.current.innerHTML for nulo
        window.print();
    }
  };

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(prev => prev + 1);
    } else {
      const result = gerarPlanoAlimentar(formData);
      if (result) {
        setPlannerData(result);
      } else {
        // Não avança se a validação falhar em gerarPlanoAlimentar
        // O alerta já foi disparado dentro da função
      }
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const renderStep = () => {
    // ... (código das etapas do formulário mantido como antes)
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <Label htmlFor="objetivoPrincipal" className="text-lg font-medium">Qual seu objetivo principal?</Label>
            <RadioGroup
              id="objetivoPrincipal"
              value={formData.objetivoPrincipal}
              onValueChange={(value) => handleChange("objetivoPrincipal", value)}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2"><RadioGroupItem value="perder_peso" id="perder_peso" /><Label htmlFor="perder_peso">Perder peso</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="ganhar_massa" id="ganhar_massa" /><Label htmlFor="ganhar_massa">Ganhar massa muscular</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="ganhar_peso" id="ganhar_peso" /><Label htmlFor="ganhar_peso">Ganhar peso</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="manter_forma" id="manter_forma" /><Label htmlFor="manter_forma">Manter forma atual</Label></div>
            </RadioGroup>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <Label htmlFor="nivelAtividade" className="text-lg font-medium">Qual seu nível de atividade física?</Label>
            <Select value={formData.nivelAtividade} onValueChange={(value) => handleChange("nivelAtividade", value)}>
              <SelectTrigger id="nivelAtividade"><SelectValue placeholder="Selecione seu nível de atividade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sedentario">Sedentário</SelectItem>
                <SelectItem value="levemente_ativo">Levemente ativo</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="muito_ativo">Muito ativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <Label htmlFor="peso" className="text-lg font-medium">Qual seu peso atual? (kg)</Label>
            <Input id="peso" type="number" value={formData.peso || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange("peso", e.target.value)} placeholder="Ex: 70"/>
          </div>
        );
      case 4:
        return (
          <div className="space-y-4">
            <Label htmlFor="altura" className="text-lg font-medium">Qual sua altura? (cm)</Label>
            <Input id="altura" type="number" value={formData.altura || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange("altura", e.target.value)} placeholder="Ex: 175"/>
          </div>
        );
      case 5:
        return (
          <div className="space-y-4">
            <Label htmlFor="idade" className="text-lg font-medium">Qual sua idade?</Label>
            <Input id="idade" type="number" value={formData.idade || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange("idade", e.target.value)} placeholder="Ex: 30"/>
          </div>
        );
      case 6:
        return (
          <div className="space-y-4">
            <Label htmlFor="restricaoAlimentar" className="text-lg font-medium">Possui alguma restrição alimentar?</Label>
            <Select value={formData.restricaoAlimentar} onValueChange={(value) => handleChange("restricaoAlimentar", value)}>
              <SelectTrigger id="restricaoAlimentar"><SelectValue placeholder="Selecione uma opção" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhuma">Nenhuma</SelectItem>
                <SelectItem value="lactose">Lactose</SelectItem>
                <SelectItem value="gluten">Glúten</SelectItem>
                <SelectItem value="veganismo">Veganismo</SelectItem>
                <SelectItem value="outras">Outras</SelectItem>
              </SelectContent>
            </Select>
            {formData.restricaoAlimentar === 'outras' && (
              <div className="mt-4">
                <Label htmlFor="outraRestricao" className="text-md font-medium">Especifique sua outra restrição:</Label>
                <Textarea id="outraRestricao" value={formData.outraRestricao || ''} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => handleChange("outraRestricao", e.target.value)} placeholder="Descreva sua restrição alimentar aqui..." className="mt-1"/>
              </div>
            )}
          </div>
        );
      case 7:
        return (
          <div className="space-y-4">
            <Label htmlFor="alimentoIndispensavel" className="text-lg font-medium">Há algum alimento que você considera indispensável?</Label>
            <Textarea id="alimentoIndispensavel" value={formData.alimentoIndispensavel || ''} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => handleChange("alimentoIndispensavel", e.target.value)} placeholder="Ex: Café pela manhã, uma fruta específica, etc."/>
          </div>
        );
      default:
        return <div>Etapa {currentStep} em construção...</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-100 via-blue-100 to-purple-100 flex flex-col items-center p-4 text-gray-800 selection:bg-green-200 font-sans">
      <header className="w-full max-w-3xl mx-auto my-8 text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-green-700">Planner Alimentar Inteligente</h1>
        <p className="text-md md:text-lg text-blue-600 mt-2">Seu plano alimentar personalizado em poucos cliques!</p>
      </header>

      <main className="w-full max-w-3xl mx-auto bg-white shadow-xl rounded-lg p-6 md:p-10">
        {plannerData ? (
          <div ref={plannerRef} className="planner-results">
            <Card className="w-full border-none shadow-none">
              <CardHeader className="text-center">
                <CardTitle className="text-green-700 text-2xl md:text-3xl">Seu Plano Alimentar Semanal</CardTitle>
                <CardDescription className="text-gray-600 text-base">Baseado nas suas informações e objetivos.</CardDescription>
                <div className="mt-4 text-lg">
                  <p>Total de Calorias Diárias Estimadas: <span className="font-semibold text-green-600">{plannerData.dailyCalories} kcal</span></p>
                  <p>Meta de Água Diária: <span className="font-semibold text-blue-500">{plannerData.waterIntake} ml ({(plannerData.waterIntake / 1000).toFixed(1)} L)</span></p>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 mt-6">
                {plannerData.weeklyPlan && Object.entries(plannerData.weeklyPlan).map(([day, dayPlan]) => (
                  <div key={day} className="mb-8 day-plan">
                    <h3 className="text-xl font-semibold text-green-600 mb-4 pb-2 border-b-2 border-green-200">{day}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 meal-grid">
                      {Object.entries(dayPlan.meals).map(([mealName, mealDetails]) => (
                        <Card key={mealName} className="bg-green-50 hover:shadow-md transition-shadow meal-card">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-lg text-green-700">{mealName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} <span className="text-sm font-normal text-gray-500">({mealDetails.time})</span></CardTitle>
                            <CardDescription className="text-sm text-green-800">~{mealDetails.calories} kcal</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <p className="text-gray-700 text-sm">{mealDetails.suggestion}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
              <CardFooter className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-8 pt-6 border-t border-gray-200">
                <Button onClick={handlePrint} className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-2 rounded-md text-lg w-full sm:w-auto">
                  <PrinterIcon className="mr-2 h-5 w-5" /> Imprimir / Salvar PDF
                </Button>
                <Button onClick={() => { setPlannerData(null); setCurrentStep(1); setFormData({}); }} className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-md text-lg w-full sm:w-auto">
                  Criar Novo Plano
                </Button>
              </CardFooter>
            </Card>
          </div>
        ) : (
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); handleNext(); }} className="space-y-8">
            <div className="p-6 bg-green-50 rounded-lg shadow-sm min-h-[280px] flex flex-col justify-center">
              <h2 className="text-xl font-semibold text-green-700 mb-1">Passo {currentStep} de {TOTAL_STEPS}</h2>
              <p className="text-sm text-gray-600 mb-6">Preencha as informações abaixo para personalizarmos seu plano:</p>
              {renderStep()}
            </div>
            <div className={`flex ${currentStep === 1 ? 'justify-end' : 'justify-between'} items-center pt-5 border-t border-gray-200`}>
              {currentStep > 1 && (
                <Button type="button" onClick={handlePrev} className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-2 rounded-md text-lg">
                  Anterior
                </Button>
              )}
              <Button type="submit" className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-md text-lg">
                {currentStep === TOTAL_STEPS ? 'Gerar Plano Alimentar' : 'Próximo Passo'}
              </Button>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 mt-4">
              <div className="bg-gradient-to-r from-green-400 to-blue-500 h-3 rounded-full transition-all duration-500 ease-out" style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}></div>
            </div>
          </form>
        )}
      </main>

      <footer className="w-full max-w-3xl mx-auto mt-12 mb-8 text-center text-xs md:text-sm text-gray-500">
        <p>&copy; {new Date().getFullYear()} Planner Alimentar Inteligente. Desenvolvido por Manus.</p>
        <p>Este é um protótipo. As informações geradas são apenas para demonstração e não substituem o aconselhamento de um profissional de saúde.</p>
      </footer>
    </div>
  );
}

export default App;

