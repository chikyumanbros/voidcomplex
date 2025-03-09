// グローバル変数としてサイズを定義
const width = 160;  // 画面の横幅
const height = 90;  // 画面の縦幅（16:9の比率に近づける）
// グローバル変数としてlifeformsを宣言
let lifeforms = [];
// グローバル変数としてenvironmentを宣言
let environment;
// リスタート用の変数を追加
let restartTimer = 0;
const RESTART_DELAY = 50; // 30秒後にリスタート（10FPSなので300フレーム）

// グローバル変数として追加
const initialLifeCount = 50;  // 初期生命体数
const maxLifeforms = 500;     // 最大生命体数
let time = 0;                 // シミュレーション時間

document.addEventListener('DOMContentLoaded', () => {
 
    const canvas = document.getElementById('canvas');
    
    // ASCII文字のセット
    const asciiChars = '☻█▓▒░σ▪°∙*+∷∴∵·';
    // ネットワーク関係を表す特殊文字を追加
    const networkChars = '╒╓╔╕╖╗╘╙╚╛╜╝';
    
    // 代謝産物の定義
    const METABOLIC_PRODUCTS = {
        OXYGEN: 'oxygen',
        GLUCOSE: 'glucose',
        AMINO_ACIDS: 'amino_acids',
        WASTE: 'waste',
        TOXINS: 'toxins'
    };
    
    // 環境クラスの定義
    class Environment {
        constructor() {
            this.resources = new Map();
            this.grid = Array(width).fill().map(() => 
                Array(height).fill().map(() => new Map())
            );
            
            // システムリソースの状態を追加
            this.systemState = {
                cpuLoad: 0,
                memoryUsage: 0,
                networkLatency: 0,
                lastUpdate: Date.now()
            };
            
            // システムノイズの影響係数
            this.noiseFactors = {
                temperature: 0.2,    // CPU負荷は温度に影響
                turbulence: 0.15,    // メモリ使用率は環境の乱流に影響
                visibility: 0.25,    // ネットワークレイテンシーは視界に影響
                resourceDecay: 0.1   // 全体的なリソース減衰率に影響
            };
            
            // システム状態の定期更新
            this.updateSystemState();
        }
        
        // システムリソースの状態を更新
        updateSystemState() {
            const now = Date.now();
            const timeDiff = (now - this.systemState.lastUpdate) / 1000;
            
            // CPU負荷のシミュレーション（より単純な正弦波）
            this.systemState.cpuLoad = 0.3 + 0.2 * Math.sin(now / 5000);
            
            // メモリ使用率のシミュレーション（ランダムウォーク）
            this.systemState.memoryUsage = Math.max(0, Math.min(1,
                this.systemState.memoryUsage + (Math.random() - 0.5) * 0.05
            ));
            
            // ネットワークレイテンシーのシミュレーション（スパイク発生）
            if (Math.random() < 0.05) { // 5%の確率でスパイク
                this.systemState.networkLatency = Math.random();
            } else {
                this.systemState.networkLatency *= 0.95; // 徐々に回復
            }
            
            this.systemState.lastUpdate = now;
            
            // 環境への影響を適用
            this.applySystemEffects();
            
            // 次の更新をスケジュール
            setTimeout(() => this.updateSystemState(), 1000);
        }
        
        // システム状態に基づいて環境に影響を与える
        applySystemEffects() {
            // CPU負荷による温度変化
            const temperatureEffect = this.systemState.cpuLoad * this.noiseFactors.temperature;
            
            // メモリ使用率による環境の乱流
            const turbulenceEffect = this.systemState.memoryUsage * this.noiseFactors.turbulence;
            
            // ネットワークレイテンシーによる視界への影響
            const visibilityEffect = (1 - this.systemState.networkLatency) * this.noiseFactors.visibility;
            
            // グリッド全体に影響を適用（パフォーマンスのため一部のセルのみ）
            for (let x = 0; x < width; x += 4) {
                for (let y = 0; y < height; y += 4) {
                    const cell = this.grid[x][y];
                    
                    // 温度による代謝への影響
                    cell.forEach((amount, type) => {
                        if (type === METABOLIC_PRODUCTS.GLUCOSE) {
                            const newAmount = amount * (1 - temperatureEffect);
                            cell.set(type, newAmount);
                        }
                    });
                    
                    // 乱流による資源の拡散
                    if (turbulenceEffect > 0.5) {
                        this.diffuseResources(x, y, turbulenceEffect);
                    }
                }
            }
        }
        
        // 資源の拡散をシミュレート
        diffuseResources(x, y, intensity) {
            const cell = this.grid[x][y];
            const diffusionRate = 0.1 * intensity;
            
            cell.forEach((amount, type) => {
                const diffusedAmount = amount * diffusionRate;
                
                // 隣接セルに拡散
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            this.addResource(type, {x: nx, y: ny}, diffusedAmount / 8);
                        }
                    }
                }
                
                // 元のセルから減少
                cell.set(type, amount - diffusedAmount);
            });
        }

        addResource(type, position, amount, subType = null) {
            const x = Math.floor(position.x);
            const y = Math.floor(position.y);
            if (x >= 0 && x < width && y >= 0 && y < height) {
                const cell = this.grid[x][y];
                if (type === METABOLIC_PRODUCTS.TOXINS && subType) {
                    // 毒素の場合は種類も保存
                    const toxinKey = `${type}_${subType}`;
                    cell.set(toxinKey, (cell.get(toxinKey) || 0) + amount);
                } else {
                    cell.set(type, (cell.get(type) || 0) + amount);
                }
            }
        }

        getResources(position, radius) {
            const x = Math.floor(position.x);
            const y = Math.floor(position.y);
            const resources = new Map();
            
            for (let i = -radius; i <= radius; i++) {
                for (let j = -radius; j <= radius; j++) {
                    const checkX = x + i;
                    const checkY = y + j;
                    if (checkX >= 0 && checkX < width && checkY >= 0 && checkY < height) {
                        const cell = this.grid[checkX][checkY];
                        cell.forEach((amount, type) => {
                            resources.set(type, (resources.get(type) || 0) + amount);
                        });
                    }
                }
            }
            return resources;
        }
    }
    
    // 環境インスタンスを作成（ここで初期化）
    environment = new Environment();
    
    // ライフシミュレーションのパラメータ
    const energyDecayRate = 0.001;
    const reproductionThreshold = 0.6;
    const reproductionCost = 0.15;
    const mutationRate = 0.1;
    const foodGenerationRate = 0.05;  // 0.08から0.05に減少（食物生成を少し減らす、代わりに捕食が栄養源になる）
    const maxAge = 1000;
    
    // 捕食関連のパラメータ
    const predationRange = 8;  // 5から8に増加（捕食可能な距離を拡大）
    const predationEnergyGain = 0.8;  // 0.6から0.8に増加（捕食で得られるエネルギーの割合を増加）
    const predationSuccessRate = 0.8;  // 0.7から0.8に増加（捕食の成功率を向上）
    
    // アニメーションの状態
    let time = 0;
    
    // 生命体クラス
    class Lifeform {
        constructor(x, y, z, energy, dna = null) {
            // 位置
            this.position = {
                x: x !== undefined ? x : Math.random() * width,
                y: y !== undefined ? y : Math.random() * height,
                z: z !== undefined ? z : Math.random() * 20 - 10
            };
            
            // デジタル代謝の状態を追加
            this.digitalMetabolism = {
                processedData: 0,
                cacheEfficiency: 0.8 + Math.random() * 0.2,
                wasteAccumulation: 0
            };
            
            // 情報エントロピーの状態を追加
            this.informationState = {
                entropy: 0.5,
                orderLevel: 1.0
            };
            
            // 速度（移動方向と速さ）
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.1 + Math.random() * 0.3;
            this.velocity = {
                x: Math.cos(angle) * speed,
                y: Math.sin(angle) * speed,
                z: (Math.random() - 0.5) * speed * 0.5
            };
            
            // 加速度
            this.acceleration = { x: 0, y: 0, z: 0 };
            
            // 生命体の特性
            this.dna = dna || {
                // 基本的な特性
                speed: 0.5 + Math.random() * 0.5,
                efficiency: 0.7 + Math.random() * 0.4,
                perception: 0.6 + Math.random() * 0.6,
                foodAttraction: 0.8 + Math.random() * 0.8,
                socialBehavior: Math.random() * 2 - 1,
                reproductionRate: 0.3 + Math.random() * 0.7,
                predatory: Math.random(),
                size: 0.3 + Math.random() * 0.7,
                
                // メタプログラミング関連の特性を追加
                metaprogrammingAbility: 0.2 + Math.random() * 0.6,
                learningRate: 0.3 + Math.random() * 0.5,
                creativity: 0.1 + Math.random() * 0.7,
                adaptability: 0.4 + Math.random() * 0.5,
                
                // 光合成システム（改良）
                photosynthesis: {
                    efficiency: Math.random(),        // 基本効率
                    depth: {
                        optimal: Math.random() * 10 - 5,  // 最適深度
                        range: 0.2 + Math.random() * 0.3  // 許容範囲
                    },
                    wavelengths: [
                        // 可視光域での光合成効率
                        { min: 400, max: 500, efficiency: Math.random() },  // 青色光
                        { min: 500, max: 600, efficiency: Math.random() },  // 緑色光
                        { min: 600, max: 700, efficiency: Math.random() }   // 赤色光
                    ],
                    adaptations: {
                        nightMode: Math.random() * 0.3,     // 夜間の光合成効率
                        stressResponse: Math.random() * 0.5  // ストレス下での効率
                    }
                },

                // 毒素システム（改良）
                toxins: {
                    types: {
                        neural: {          // 神経毒
                            strength: Math.random() * 0.5,
                            developmentCost: 0.3,
                            effectRange: 2 + Math.random() * 3
                        },
                        cellular: {        // 細胞毒
                            strength: Math.random() * 0.5,
                            developmentCost: 0.4,
                            effectRange: 1 + Math.random() * 2
                        },
                        digestive: {       // 消化器毒
                            strength: Math.random() * 0.5,
                            developmentCost: 0.2,
                            effectRange: 1.5 + Math.random() * 2
                        },
                        genetic: {         // 遺伝子操作毒素（新規）
                            strength: Math.random() * 0.3,
                            developmentCost: 0.5,
                            effectRange: 1 + Math.random() * 1.5,
                            mutagenicPotential: Math.random() * 0.5  // 突然変異を引き起こす能力
                        }
                    },
                    resistance: {
                        neural: Math.random(),
                        cellular: Math.random(),
                        digestive: Math.random(),
                        genetic: Math.random() * 0.3  // 初期値は低め（進化の余地を残す）
                    },
                    adaptation: {
                        productionRate: Math.random() * 0.3,    // 毒素生成速度
                        storageCapacity: 0.5 + Math.random(),   // 毒素貯蔵能力
                        releaseControl: Math.random()           // 毒素放出の制御能力
                    }
                },

                // 遺伝子ネットワーク（新規）
                geneNetwork: {
                    photosynthesis: {
                        enhancedBy: ['efficiency', 'regenerationRate'],
                        suppressedBy: ['toxins.adaptation.productionRate'],
                        influences: ['energy', 'growth']
                    },
                    toxins: {
                        enhancedBy: ['efficiency', 'size'],
                        suppressedBy: ['photosynthesis.efficiency'],
                        influences: ['predation', 'defense']
                    }
                },
                
                // その他の既存の特性は維持
                mobility: Math.random(),
                growthRate: 0.1 + Math.random() * 0.4,
                
                // Boidの動き
                separationWeight: 0.3 + Math.random() * 0.2,
                alignmentWeight: 0.2 + Math.random() * 0.2,
                cohesionWeight: 0.2 + Math.random() * 0.2,
                
                // 環境適応性
                depthPreference: (Math.random() * 10) - 5,
                depthTolerance: 0.2 + Math.random() * 0.2,
                
                regenerationRate: Math.random() * 0.05,
                
                // 繁殖戦略
                offspringCount: 1,
                parentalCare: 0.1 + Math.random() * 0.2,
                
                // 行動パターン
                nocturnality: 0.4 + Math.random() * 0.2,
                territoriality: Math.random() * 0.2,
                
                // 寄生システム
                parasitism: {
                    capability: Math.random(),        // 寄生能力
                    hostPreference: Math.random(),    // 好む宿主タイプ
                    reproductiveDefect: Math.random() > 0.8,  // 80%の確率で自力繁殖不能
                    adaptations: {
                        hostControl: Math.random(),   // 宿主の行動を制御する能力
                        resourceDrain: Math.random(), // 宿主からのエネルギー吸収効率
                        hostImmuneSuppression: Math.random()  // 宿主の免疫抑制能力
                    }
                },
                
                // 寄生への耐性システム
                parasiteResistance: {
                    immuneStrength: Math.random(),    // 免疫力
                    detectionAbility: Math.random(),  // 寄生者の検出能力
                    recoveryRate: Math.random()       // 寄生からの回復率
                },
                
                // DNAに以下のような特性を追加
                resourceExchange: {
                    giveRate: Math.random(),      // リソースを提供する傾向
                    receiveRate: Math.random(),   // リソースを受け取る傾向
                    exchangeRange: Math.random(), // 交換可能な範囲
                    exchangeType: {              // 交換可能なリソースタイプ
                        energy: Math.random(),
                        nutrients: Math.random(),
                        protection: Math.random()
                    }
                },
                
                metabolicPathways: {
                    wasteProducts: [],           // 代謝産物（他の生物のリソースになりうる）
                    requiredResources: [         // 必要な資源の初期設定
                        METABOLIC_PRODUCTS.GLUCOSE,
                        METABOLIC_PRODUCTS.OXYGEN
                    ],
                    byproducts: []              // 副産物（他の生物に有益または有害）
                }
            };
            
            // DNAが渡された場合でも、metabolicPathwaysが存在することを保証
            if (!this.dna.metabolicPathways) {
                this.dna.metabolicPathways = {
                    wasteProducts: [],
                    requiredResources: [
                        METABOLIC_PRODUCTS.GLUCOSE,
                        METABOLIC_PRODUCTS.OXYGEN
                    ],
                    byproducts: []
                };
            }
            
            // 生命体の状態
            this.energy = energy !== undefined ? energy : 0.8 + Math.random() * 0.2;
            this.age = 0;
            this.isDead = false;
            this.deathTime = 0;        // 死亡時刻
            this.decompositionTime = 0; // 分解までの時間
            this.lastReproductionTime = 0;
            this.size = Math.max(0.1, Math.min(1.0, 0.1 + Math.random() * 0.3));  // サイズを0.1-1.0に制限
            this.maxSize = Math.max(this.size, Math.min(1.0, this.dna?.size || 0.3));  // 最大サイズも制限
            
            // 捕食関連の状態
            this.lastPredationTime = 0;
            this.lastPredationAttemptTime = 0;
            this.isPredator = (this.dna?.predatory || 0) > 0.6 && (this.dna?.mobility || 0) > 0.4;
            
            // 捕食者の場合、移動能力を強化
            if (this.isPredator) {
                this.dna.mobility = Math.max(0.7, this.dna.mobility);
                this.dna.speed = Math.max(0.8, this.dna.speed);
                // 捕食者の初期速度を上げる
                const predatorSpeed = 0.2 + Math.random() * 0.4;
                this.velocity = {
                    x: Math.cos(angle) * predatorSpeed,
                    y: Math.sin(angle) * predatorSpeed,
                    z: (Math.random() - 0.5) * predatorSpeed * 0.5
                };
            }
            
            // 生命体の色
            this.baseHue = this.calculateBaseHue();
            
            // 物理的な制約のためのパラメータを追加
            this.terminalVelocity = 1.0;  // 終端速度
            this.gravityStrength = 0.001;  // 重力の強さ
            this.dragCoefficient = 0.01;  // 空気抵抗係数
            this.metabolicStress = 0;     // 代謝ストレス（高速移動によるダメージ蓄積）
            
            // 代謝関連の状態を追加
            this.metabolicState = {
                storedResources: new Map(),
                lastMetabolism: 0,
                metabolicRate: 0.12, // 0.1から0.12に増加
                resourceEfficiency: (this.dna?.efficiency || 0.5) * 1.1, // 効率を10%向上
                nutrientBalance: {
                    glucose: 0.5,
                    aminoAcids: 0.3,
                    oxygen: 0.2
                },
                wasteProcessingRate: 0.08 // 廃棄物処理効率を追加
            };
            
            // 慣性関連のパラメータを追加
            this.inertia = 0.99;  // 慣性係数（高いほど慣性が強い）
            this.turnRate = 0.05; // 方向転換の速度（低いほど滑らか）
            this.accelerationSmoothing = 0.99; // 加速度の平滑化係数
            this.lastAcceleration = { x: 0, y: 0, z: 0 }; // 前回の加速度を保存
            
            // システムノイズへの適応状態を追加
            this.adaptationState = {
                temperatureTolerance: 0.5,
                turbulenceResistance: 0.5,
                visualAdaptation: 0.5,
                lastAdaptation: Date.now()
            };
            
            // 適応コストを追加
            this.adaptationCosts = {
                temperature: 0.01,    // 温度適応のエネルギーコスト
                turbulence: 0.015,   // 乱流耐性のエネルギーコスト
                visual: 0.008        // 視覚適応のエネルギーコスト
            };
            
            // 認知階層システムを追加
            this.cognition = new CognitiveHierarchy();
            
            // 認知能力に関連する DNA 特性を追加
            this.dna.cognition = {
                learningRate: 0.3 + Math.random() * 0.7,
                abstractionCapacity: 0.1 + Math.random() * 0.4,
                metacognitionAbility: 0.05 + Math.random() * 0.3,
                patternRecognition: 0.2 + Math.random() * 0.6
            };
            
            // DNA修復システムを追加
            this.dnaRepairSystem = new DNARepairSystem(this);
            
            // DNA修復能力に関連する特性を追加
            if (!this.dna.errorDetection) this.dna.errorDetection = 0.4 + Math.random() * 0.5;
            if (!this.dna.repairEfficiency) this.dna.repairEfficiency = 0.3 + Math.random() * 0.6;
            
            // 通信能力に関連する DNA 特性を追加
            if (!this.dna.communicationBandwidth) this.dna.communicationBandwidth = 0.3 + Math.random() * 0.5;
            if (!this.dna.communicationReliability) this.dna.communicationReliability = 0.4 + Math.random() * 0.5;
            
            // 通信システムを初期化
            this.communicationSystem = new CommunicationSystem(this);
            
            // 一意のID
            this.id = Math.random().toString(36).substr(2, 9);
            
            // メモリシステム
            this.memory = {
                resourceLocations: [],
                threats: [],
                allies: [],
                environmentalKnowledge: {}
            };
            
            // 最後に発見したリソース
            this.lastFoundResource = null;
            
            // メタプログラミングシステムを初期化
            this.metaprogrammingSystem = new MetaprogrammingSystem(this);
        }
        
        calculateBaseHue() {
            if (this.dna?.photosynthesis?.efficiency > 0.6) {
                // 光合成能力が高い生命体は緑系
                return 90 + Math.floor((this.dna?.photosynthesis?.efficiency || 0.5) * 30);
            } else if (this.isPredator) {
                // 捕食者は赤系
                return 0 + Math.floor((this.dna?.predatory || 0.5) * 60);
            } else {
                // その他は青系
                return 180 + Math.floor((1 - (this.dna?.predatory || 0.5)) * 60);
            }
        }
        
        // 他の生命体との相互作用（捕食を含む）
        interact(lifeforms, environment) {
            let steering = { x: 0, y: 0, z: 0 };
            let count = 0;
            
            // Boidの動きのための変数
            let separation = { x: 0, y: 0, z: 0 };
            let alignment = { x: 0, y: 0, z: 0 };
            let cohesion = { x: 0, y: 0, z: 0 };
            let flockCount = 0;
            let avgPosition = { x: 0, y: 0, z: 0 };
            let avgVelocity = { x: 0, y: 0, z: 0 };
            
            // 毒素忌避のための変数を追加
            let toxinAvoidance = { x: 0, y: 0, z: 0 };
            let toxinCount = 0;
            
            // 捕食対象または仲間を探す
            let preyFound = false;
            let closestPreyDist = Infinity;
            let closestPrey = null;
            
            // 死体との相互作用のための変数
            let closestCorpseDist = Infinity;
            let closestCorpse = null;
            
            // 知覚範囲を計算
            const perceptionRadius = 15 * this.dna.perception;
            
            // 捕食者の場合、捕食範囲を拡大（捕食傾向が強いほど広範囲）
            const predationRange = this.isPredator ? 5 * (1 + this.dna.predatory * 0.5) : 0;
            const predationSuccessRate = 0.9 * this.dna.predatory; // 0.7から0.9に増加（捕食成功率を向上）
            const predationEnergyGain = 0.5 + (this.dna.predatory * 0.3); // 0.3から0.5に基本値を増加、係数も0.2から0.3に増加
            
            // 現在の時間を取得
            const time = performance.now();
            
            for (const other of lifeforms) {
                if (other === this) continue;
                
                const dx = other.position.x - this.position.x;
                const dy = other.position.y - this.position.y;
                const dz = other.position.z - this.position.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                if (distance < perceptionRadius) {
                    if (other.isDead) {
                        // 死体の毒素を避ける行動を毒性タイプに基づいて計算
                        const mainToxinResistance = this.dna?.toxins?.resistance?.neural || 0.1;
                        const secondaryToxinResistance = this.dna?.toxins?.resistance?.cellular || 0.1;
                        const avgResistance = (mainToxinResistance + secondaryToxinResistance) / 2;
                        
                        if (avgResistance < 0.5) {
                            const mainToxinForce = this.dna?.toxins?.types?.neural?.strength || 0.1;
                            const secondaryToxinForce = (this.dna?.toxins?.types?.cellular?.strength || 0.1) * 0.5;
                            const totalToxinForce = (mainToxinForce + secondaryToxinForce) * (1 - avgResistance);
                            const avoidanceStrength = totalToxinForce * (1 - distance / perceptionRadius);
                            
                            toxinAvoidance.x -= dx * avoidanceStrength;
                            toxinAvoidance.y -= dy * avoidanceStrength;
                            toxinAvoidance.z -= dz * avoidanceStrength;
                            toxinCount++;
                        }
                        
                        // 毒素耐性が高い場合のみ死体に接近
                        if (avgResistance > 0.5 && distance < closestCorpseDist) {
                            closestCorpseDist = distance;
                            closestCorpse = other;
                        }
                        continue;
                    }
                    
                    // 生存中の生命体との毒素関連の相互作用も更新
                    const otherMainToxinResistance = this.dna?.toxins?.resistance?.neural || 0.1;
                    const otherSecondaryToxinResistance = this.dna?.toxins?.resistance?.cellular || 0.1;
                    const avgOtherResistance = (otherMainToxinResistance + otherSecondaryToxinResistance) / 2;
                    
                    if (avgOtherResistance < 0.5 && ((this.dna?.toxins?.types?.neural?.strength || 0) > 0.3 || 
                        (this.dna?.toxins?.types?.cellular?.strength || 0) > 0.3)) {
                        const mainToxinForce = this.dna?.toxins?.types?.neural?.strength || 0.1;
                        const secondaryToxinForce = (this.dna?.toxins?.types?.cellular?.strength || 0.1) * 0.5;
                        const totalToxinForce = (mainToxinForce + secondaryToxinForce) * (1 - avgOtherResistance);
                        const avoidanceStrength = totalToxinForce * (1 - distance / perceptionRadius);
                        
                        toxinAvoidance.x -= dx * avoidanceStrength;
                        toxinAvoidance.y -= dy * avoidanceStrength;
                        toxinAvoidance.z -= dz * avoidanceStrength;
                        toxinCount++;
                    }
                    
                    // 捕食者の場合、被食者を探す
                    if (this.isPredator && !other.isPredator && distance < closestPreyDist) {
                        // 捕食傾向が強いほど、サイズの大きな生命体も捕食対象にする
                        const sizeThreshold = 0.8 - (this.dna.predatory * 0.3);
                        if (this.dna.size > other.dna.size * sizeThreshold) {
                            closestPreyDist = distance;
                            closestPrey = other;
                            preyFound = true;
                        }
                    }
                    
                    // 同じタイプの生命体との群れ行動
                    if (this.isPredator === other.isPredator) {
                        // 分離（Separation）
                        const separationForce = 1 / Math.max(0.1, distance);
                        separation.x += (dx / distance) * -separationForce;
                        separation.y += (dy / distance) * -separationForce;
                        separation.z += (dz / distance) * -separationForce;
                        
                        // 整列（Alignment）
                        alignment.x += other.velocity.x;
                        alignment.y += other.velocity.y;
                        alignment.z += other.velocity.z;
                        
                        // 結合（Cohesion）
                        avgPosition.x += other.position.x;
                        avgPosition.y += other.position.y;
                        avgPosition.z += other.position.z;
                        
                        flockCount++;
                    }
                    
                    // 捕食者と被食者の関係に基づく追加の力
                    if (this.isPredator && !other.isPredator) {
                        // 捕食傾向が強いほど、被食者に強く引き寄せられる
                        const predatoryFactor = 0.5 + (this.dna.predatory * 0.5);
                        steering.x += dx * predatoryFactor;
                        steering.y += dy * predatoryFactor;
                        steering.z += dz * predatoryFactor;
                    } else if (!this.isPredator && other.isPredator) {
                        // 被食者は捕食者から逃げる
                        steering.x -= dx;
                        steering.y -= dy;
                        steering.z -= dz;
                    }
                    
                    count++;
                }
            }
            
            // 死体への接近と毒素吸収
            if (closestCorpse && closestCorpseDist < 5) {
                // 毒素耐性と吸収能力に基づいてエネルギーを得る
                const absorbedEnergy = closestCorpse.energy * 
                    (this.dna.toxins?.adaptation?.storageCapacity || 0.5) * 
                    Math.min(1, (this.dna.toxins?.resistance?.neural || 0.1) / 
                    (closestCorpse.dna.toxins?.types?.neural?.strength || 0.1)) * 0.1;
                
                if (absorbedEnergy > 0) {
                    this.energy = Math.min(1.0, this.energy + absorbedEnergy);
                    closestCorpse.energy *= 0.9; // 吸収された分のエネルギーを減少
                }
                
                // 死体に向かう力を生成
                const magnitude = Math.sqrt(
                    steering.x * steering.x + 
                    steering.y * steering.y + 
                    steering.z * steering.z
                );
                
                if (magnitude > 0) {
                    steering.x = (steering.x / magnitude) * this.dna.speed;
                    steering.y = (steering.y / magnitude) * this.dna.speed;
                    steering.z = (steering.z / magnitude) * this.dna.speed;
                }
            }
            
            // Boidの動きを適用
            if (flockCount > 0) {
                // 分離の正規化と重み付け
                const sepMag = Math.sqrt(
                    separation.x * separation.x +
                    separation.y * separation.y +
                    separation.z * separation.z
                );
                if (sepMag > 0) {
                    // flockingBehaviorのプロパティがあれば使用、なければDNAの直接の値を使用
                    const sepWeight = this.dna.flockingBehavior?.separation || this.dna.separationWeight;
                    separation.x = (separation.x / sepMag) * sepWeight;
                    separation.y = (separation.y / sepMag) * sepWeight;
                    separation.z = (separation.z / sepMag) * sepWeight;
                }
                
                // 整列の正規化と重み付け
                const alignWeight = this.dna.flockingBehavior?.alignment || this.dna.alignmentWeight;
                alignment.x = (alignment.x / flockCount) * alignWeight;
                alignment.y = (alignment.y / flockCount) * alignWeight;
                alignment.z = (alignment.z / flockCount) * alignWeight;
                
                // 結合の計算と重み付け
                avgPosition.x = avgPosition.x / flockCount;
                avgPosition.y = avgPosition.y / flockCount;
                avgPosition.z = avgPosition.z / flockCount;
                
                const cohWeight = this.dna.flockingBehavior?.cohesion || this.dna.cohesionWeight;
                cohesion.x = (avgPosition.x - this.position.x) * cohWeight;
                cohesion.y = (avgPosition.y - this.position.y) * cohWeight;
                cohesion.z = (avgPosition.z - this.position.z) * cohWeight;
                
                // すべての力を合成
                steering.x += separation.x + alignment.x + cohesion.x;
                steering.y += separation.y + alignment.y + cohesion.y;
                steering.z += separation.z + alignment.z + cohesion.z;
            }
            
            // 捕食行動
            if (preyFound && closestPrey && closestPreyDist < predationRange) {
                // 捕食傾向が強いほどクールダウン時間が短い
                const cooldownTime = Math.max(5, 15 - (this.dna.predatory * 10));
                if (time - this.lastPredationAttemptTime > cooldownTime) {
                    this.lastPredationAttemptTime = time;
                    
                    // サイズ差と捕食傾向による成功率の計算
                    const sizeDifference = Math.pow(this.dna.size / closestPrey.dna.size, 0.7); // 0.8から0.7に変更（サイズ差の影響を軽減）
                    const successChance = predationSuccessRate * sizeDifference * this.dna.predatory;
                    
                    if (Math.random() < successChance) {
                        // 捕食成功
                        this.lastPredationTime = time;
                        
                        // 獲物からエネルギーを得る
                        const gainedEnergy = closestPrey.energy * predationEnergyGain;
                        this.energy += gainedEnergy;
                        
                        // 捕食成功時に少量の回復効果を追加
                        if (this.dna.regenerationRate > 0) {
                            this.energy += 0.05 * this.dna.regenerationRate;
                        }
                        
                        this.energy = Math.min(1.0, this.energy);  // エネルギー上限
                        
                        // 獲物を死亡させる
                        closestPrey.isDead = true;
                    }
                }
            }
            
            // 毒素忌避の力を追加
            if (toxinCount > 0) {
                const toxinMagnitude = Math.sqrt(
                    toxinAvoidance.x * toxinAvoidance.x +
                    toxinAvoidance.y * toxinAvoidance.y +
                    toxinAvoidance.z * toxinAvoidance.z
                );
                
                if (toxinMagnitude > 0) {
                    const toxinWeight = 1.5; // 毒素忌避の重み（他の力より優先）
                    toxinAvoidance.x = (toxinAvoidance.x / toxinMagnitude) * toxinWeight;
                    toxinAvoidance.y = (toxinAvoidance.y / toxinMagnitude) * toxinWeight;
                    toxinAvoidance.z = (toxinAvoidance.z / toxinMagnitude) * toxinWeight;
                    
                    steering.x += toxinAvoidance.x;
                    steering.y += toxinAvoidance.y;
                    steering.z += toxinAvoidance.z;
                }
            }
            
            if (count > 0) {
                steering.x /= count;
                steering.y /= count;
                steering.z /= count;
                
                // ベクトルの正規化と速度の適用
                const magnitude = Math.sqrt(
                    steering.x * steering.x + 
                    steering.y * steering.y + 
                    steering.z * steering.z
                );
                
                if (magnitude > 0) {
                    steering.x = (steering.x / magnitude) * this.dna.speed * 0.5;
                    steering.y = (steering.y / magnitude) * this.dna.speed * 0.5;
                    steering.z = (steering.z / magnitude) * this.dna.speed * 0.5;
                }
            }
            
            // 代謝産物による相互作用を追加
            for (const other of lifeforms) {
                if (other === this || other.isDead) continue;
                
                const distance = this.getDistanceTo(other);
                // resourceExchangeの存在チェックを追加
                if (this.dna?.resourceExchange?.exchangeRange && 
                    distance < this.dna.resourceExchange.exchangeRange * 5) {
                    // 代謝産物の交換
                    const exchangeEfficiency = Math.max(0, 1 - distance / (this.dna.resourceExchange.exchangeRange * 5));
                    
                    // giveRateの存在チェックも追加
                    if (this.dna.resourceExchange.giveRate > 0.5) {
                        const resources = environment.getResources(this.position, 1);
                        resources.forEach((amount, type) => {
                            if (other.needsResource(type)) {
                                const given = amount * exchangeEfficiency * this.dna.resourceExchange.giveRate;
                                environment.addResource(type, other.position, given);
                                environment.addResource(type, this.position, -given);
                                
                                // 協力関係の強化
                                this.strengthenBond(other);
                            }
                        });
                    }
                }
                
                // 遺伝子操作毒素の効果
                if (this.dna?.toxins?.types?.genetic?.strength > 0.2 && 
                    distance < this.dna.toxins.types.genetic.effectRange * 2) {
                    
                    // 遺伝子操作毒素の放出
                    const toxinStrength = this.dna.toxins.types.genetic.strength;
                    const resistanceLevel = other.dna?.toxins?.resistance?.genetic || 0;
                    const effectiveStrength = Math.max(0, toxinStrength - resistanceLevel);
                    
                    if (effectiveStrength > 0.1 && Math.random() < effectiveStrength * 0.5) {
                        // エピジェネティック状態の初期化
                        if (!other.epigeneticState) other.epigeneticState = new EpigeneticState();
                        
                        // ランダムな遺伝子を選択して発現を変化させる
                        const targetGenes = ['speed', 'perception', 'efficiency', 'photosynthesis.efficiency'];
                        const targetGene = targetGenes[Math.floor(Math.random() * targetGenes.length)];
                        
                        // 遺伝子発現の変化を記録
                        other.epigeneticState.updateMethylation(targetGene, effectiveStrength);
                        
                        // 遺伝子発現の変化を適用
                        if (!other._geneExpressionModifiers) other._geneExpressionModifiers = {};
                        other._geneExpressionModifiers[targetGene] = {
                            factor: 1 - effectiveStrength,
                            duration: 50 + Math.floor(effectiveStrength * 150)  // 効果の持続時間
                        };
                        
                        // 毒素放出のエネルギーコスト
                        this.energy -= this.dna.toxins.types.genetic.developmentCost * 0.1;
                        
                        // 毒素の影響下にある生命体は遺伝子伝達の受容体が活性化
                        other._receptiveToTransfer = true;
                        
                        // 突然変異の可能性
                        if (Math.random() < this.dna.toxins.types.genetic.mutagenicPotential * 0.3) {
                            // 遺伝子の水平伝達
                            this.transferGene(other);
                        }
                        
                        // 交配の可能性を高める
                        if (this.dna._geneticHackingPotential && Math.random() < this.dna._geneticHackingPotential * 0.2) {
                            // 自身も受容体を活性化
                            this._receptiveToTransfer = true;
                            
                            // 交配を試みる
                            if (Math.random() < 0.2) {
                                this.attemptMating(other);
                            }
                        }
                    }
                }
                
                // 水平遺伝子伝達（低確率で自然発生）
                if (distance < 2 && Math.random() < 0.005) {
                    this.transferGene(other);
                }
            }
            
            return steering;
        }
        
        // 遺伝子の水平伝達
        transferGene(other) {
            // 受容体が活性化されているか、低確率で発生
            if (other._receptiveToTransfer || Math.random() < 0.1) {
                // 転移可能な遺伝子を選択
                const transferableGenes = Object.keys(this.dna).filter(key => 
                    typeof this.dna[key] === 'number' && key !== '_requires_host'
                );
                
                if (transferableGenes.length > 0) {
                    const geneToTransfer = transferableGenes[Math.floor(Math.random() * transferableGenes.length)];
                    
                    // 遺伝子の転移（混合）
                    other.dna[geneToTransfer] = (other.dna[geneToTransfer] || 0) * 0.7 + this.dna[geneToTransfer] * 0.3;
                    
                    // 遺伝子転移のエネルギーコスト
                    this.energy -= 0.05;
                    
                    // 遺伝子獲得のマーカー
                    other._acquiredGenes = other._acquiredGenes || [];
                    other._acquiredGenes.push({
                        gene: geneToTransfer,
                        source: this,
                        time: time
                    });
                    
                    // 免疫応答の可能性
                    if (other.dna?.toxins?.resistance?.genetic > 0.6 && Math.random() < other.dna.toxins.resistance.genetic * 0.5) {
                        // 免疫応答が成功した場合、転移した遺伝子を拒絶
                        delete other.dna[geneToTransfer];
                        other._immune_response = true;
                    }
                    
                    // 交配の可能性を追加
                    if (this._acquiredGenes && other._acquiredGenes && 
                        this._receptiveToTransfer && other._receptiveToTransfer &&
                        Math.random() < 0.3) { // 30%の確率で交配が発生
                        this.attemptMating(other);
                    }
                }
            }
        }
        
        // 交配を試みるメソッド
        attemptMating(partner) {
            // 両者のエネルギーが十分かチェック
            if (this.energy < 0.4 || partner.energy < 0.4) return;
            
            // 交配のエネルギーコスト
            const matingCost = 0.2;
            this.energy -= matingCost;
            partner.energy -= matingCost;
            
            // 遺伝子組み換えによる子孫のDNA生成
            const childDna = this.crossover(partner);
            
            // 遺伝子ハッキングの影響を子孫に反映
            if (this._acquiredGenes || partner._acquiredGenes) {
                // 毒素システムの強化
                childDna.toxins = childDna.toxins || {};
                childDna.toxins.types = childDna.toxins.types || {};
                childDna.toxins.types.genetic = childDna.toxins.types.genetic || {
                    strength: 0.3,
                    developmentCost: 0.4,
                    effectRange: 2.0,
                    mutagenicPotential: 0.4
                };
                
                // 遺伝子ハッキングによる特殊能力
                childDna._geneticHackingPotential = 0.5 + Math.random() * 0.5;
                
                // 交配による特殊フラグ
                childDna._matingOffspring = true;
            }
            
            // 子孫の位置を両親の中間に設定
            const childX = (this.position.x + partner.position.x) / 2 + (Math.random() - 0.5) * 2;
            const childY = (this.position.y + partner.position.y) / 2 + (Math.random() - 0.5) * 2;
            const childZ = (this.position.z + partner.position.z) / 2 + (Math.random() - 0.5) * 2;
            
            // 子孫を生成
            const child = new Lifeform(
                childX,
                childY,
                childZ,
                0.5, // 初期エネルギー
                childDna
            );
            
            // 子孫を環境に追加
            lifeforms.push(child);
            
            // 交配記録
            this._lastMatingTime = time;
            partner._lastMatingTime = time;
            this._matingPartner = partner;
            partner._matingPartner = this;
            
            // 結合を強化
            this.strengthenBond(partner);
            partner.strengthenBond(this);
        }
        
        strengthenBond(other) {
            if (!this.bonds) this.bonds = new Map();
            const currentBond = this.bonds.get(other) || 0;
            this.bonds.set(other, Math.min(1.0, currentBond + 0.01));
            
            // 群れ行動の重みを調整
            if (this.bonds.get(other) > 0.5) {
                this.dna.cohesionWeight *= 1.01;
                this.dna.alignmentWeight *= 1.01;
            }
        }
        
        needsResource(type) {
            // 必要な資源かどうかを判定（安全なプロパティアクセス）
            return this.dna?.metabolicPathways?.requiredResources?.includes(type) || false;
        }
        
        // 境界を超えないようにする力
        checkBoundaries() {
            const margin = 2;
            let force = { x: 0, y: 0, z: 0 };
            const boundaryForce = 0.05;
            
            if (this.position.x < margin) {
                force.x = boundaryForce;
            } else if (this.position.x > width - margin) {
                force.x = -boundaryForce;
            }
            
            if (this.position.y < margin) {
                force.y = boundaryForce;
            } else if (this.position.y > height - margin) {
                force.y = -boundaryForce;
            }
            
            if (this.position.z < -10) {
                force.z = boundaryForce;
            } else if (this.position.z > 10) {
                force.z = -boundaryForce;
            }
            
            return force;
        }
        
        // 生命体の更新
        update(lifeforms, environment) {
            // 遺伝子発現の変化を適用
            if (this._geneExpressionModifiers) {
                for (const [gene, modifier] of Object.entries(this._geneExpressionModifiers)) {
                    // 遺伝子パスを解析
                    const genePath = gene.split('.');
                    let target = this.dna;
                    for (let i = 0; i < genePath.length - 1; i++) {
                        if (target[genePath[i]]) {
                            target = target[genePath[i]];
                        } else {
                            target = null;
                            break;
                        }
                    }
                    
                    const finalGene = genePath[genePath.length - 1];
                    if (target && target[finalGene] !== undefined) {
                        // 元の値を保存
                        if (!target._originalValues) target._originalValues = {};
                        if (target._originalValues[finalGene] === undefined) {
                            target._originalValues[finalGene] = target[finalGene];
                        }
                        
                        // 修飾を適用
                        target[finalGene] = target._originalValues[finalGene] * modifier.factor;
                        
                        // 持続時間を減少
                        modifier.duration--;
                        
                        // 持続時間が終了したら効果を解除
                        if (modifier.duration <= 0) {
                            target[finalGene] = target._originalValues[finalGene];
                            delete this._geneExpressionModifiers[gene];
                            
                            // 突然変異の可能性
                            if (Math.random() < 0.1) {
                                // 永続的な変異
                                target[finalGene] *= 1 + (Math.random() * 0.4 - 0.2); // -20%〜+20%の変化
                                target._originalValues[finalGene] = target[finalGene]; // 新しい基準値を設定
                            }
                        }
                    }
                }
            }
            
            // 遺伝子ハッキングへの免疫応答
            if (this._immune_response) {
                // 免疫応答のエネルギーコスト
                this.energy -= 0.02;
                
                // 免疫応答の持続時間
                if (!this._immune_response_duration) {
                    this._immune_response_duration = 50;
                } else {
                    this._immune_response_duration--;
                    if (this._immune_response_duration <= 0) {
                        this._immune_response = false;
                        delete this._immune_response_duration;
                    }
                }
                
                // 免疫応答中は遺伝子伝達の受容体が不活性化
                this._receptiveToTransfer = false;
            }
            
            // 受容体の状態を時間経過で減衰
            if (this._receptiveToTransfer && Math.random() < 0.05) {
                this._receptiveToTransfer = false;
            }
            
            // 宿主依存の処理を追加
            if (this.dna._requires_host) {
                if (!this._attached_host) {
                    // 宿主を探す
                    const potentialHosts = lifeforms.filter(host => {
                        if (host === this || host.isDead || host.dna._requires_host) return false;
                        if (host._parasites && host._parasites.length >= 3) return false;
                        return host.dna.photosynthesis?.efficiency > 0.5;
                    });

                    if (potentialHosts.length > 0) {
                        const host = potentialHosts[Math.floor(Math.random() * potentialHosts.length)];
                        if (!host._parasites) host._parasites = [];
                        host._parasites.push(this);
                        this._attached_host = host;
                        this.position = { ...host.position };
                    } else {
                        // 宿主が見つからない場合、エネルギーを急速に失う
                        this.energy *= 0.95;
                    }
                } else {
                    // 宿主からエネルギーを得る（依存度に応じて）
                    const energyDrain = this._attached_host.energy * 0.01 * (this.dna._host_dependency || 0.5);
                    this._attached_host.energy -= energyDrain;
                    this.energy += energyDrain * 0.8; // 80%の効率でエネルギー転換
                    
                    // 宿主の位置に追従
                    this.position = { ...this._attached_host.position };
                    
                    // 宿主が死亡した場合、関係を解除
                    if (this._attached_host.isDead) {
                        this._attached_host = null;
                    }
                }
            }
            
            // 死体の分解処理
            if (this.isDead) {
                if (this.deathTime === 0) {
                    this.deathTime = time;
                    // 毒性が高いほど分解に時間がかかる
                    const baseToxinStrength = this.dna?.toxins?.types?.neural?.strength || 0.1;
                    this.decompositionTime = 200 + Math.floor(baseToxinStrength * 300); // 分解時間を延長
                    
                    // 死後の初期状態を設定
                    this.decompositionStage = 0;
                    this.postMortemToxins = {
                        neural: baseToxinStrength,
                        cellular: this.dna?.toxins?.types?.cellular?.strength || 0.1,
                        digestive: this.dna?.toxins?.types?.digestive?.strength || 0.1
                    };
                }
                
                // 分解の進行度を計算
                const decompositionProgress = (time - this.deathTime) / this.decompositionTime;
                
                // 分解段階の更新（4段階）
                const newStage = Math.floor(decompositionProgress * 4);
                if (newStage > this.decompositionStage) {
                    this.decompositionStage = newStage;
                    
                    // 各段階での毒素変化
                    switch(this.decompositionStage) {
                        case 1: // 初期分解
                            // 細胞の崩壊により一時的に毒素が増加
                            Object.keys(this.postMortemToxins).forEach(type => {
                                this.postMortemToxins[type] *= 1.2;
                            });
                            break;
                        case 2: // 中期分解
                            // 毒素が徐々に環境に放出され始める
                            Object.keys(this.postMortemToxins).forEach(type => {
                                this.postMortemToxins[type] *= 0.8;
                            });
                            break;
                        case 3: // 後期分解
                            // 毒素が急速に減少
                            Object.keys(this.postMortemToxins).forEach(type => {
                                this.postMortemToxins[type] *= 0.5;
                            });
                            break;
                    }
                }
                
                // サイズの変化をより自然に
                const sizeReduction = Math.pow(1 - decompositionProgress, 2);
                this.size = Math.max(0.1, this.maxSize * sizeReduction);
                
                // 環境への毒素放出
                if (environment && this.decompositionStage > 0) {
                    // 主要な毒素タイプを判定
                    let dominantToxin = 'neural';
                    let maxStrength = this.postMortemToxins?.neural || 0;
                    
                    if (this.postMortemToxins?.cellular > maxStrength) {
                        dominantToxin = 'cellular';
                        maxStrength = this.postMortemToxins.cellular;
                    }
                    if (this.postMortemToxins?.digestive > maxStrength) {
                        dominantToxin = 'digestive';
                        maxStrength = this.postMortemToxins.digestive;
                    }
                    
                    const toxinRelease = Object.values(this.postMortemToxins).reduce((sum, val) => sum + val, 0) / 
                        (this.decompositionStage * 10);
                    environment.addResource(METABOLIC_PRODUCTS.TOXINS, this.position, toxinRelease, dominantToxin);
                }
                
                // 完全に分解されたら true を返す
                return time - this.deathTime > this.decompositionTime;
            }
            
            // 寄生の影響を処理
            if (this.parasites && this.parasites.length > 0) {
                // 各寄生者からエネルギーを奪われる
                this.parasites.forEach(parasite => {
                    const drainAmount = this.energy * parasite.dna.parasitism.adaptations.resourceDrain * 0.1;
                    this.energy -= drainAmount;
                    parasite.energy += drainAmount * 0.8;  // 80%の効率でエネルギー転換
                });
                
                // 免疫応答による寄生者の排除を試みる
                if (Math.random() < (this.dna?.parasiteResistance?.recoveryRate || 0)) {
                    this.parasites = this.parasites.filter(parasite => 
                        Math.random() > (this.dna?.parasiteResistance?.immuneStrength || 0));
                }
            }
            
            // 生存中の処理
            if (!this.isDead) {
                // エネルギー減少（捕食者はエネルギー消費が少ない）
                const energyDecayMultiplier = this.isPredator ? 0.7 : 1.0; // 捕食者のエネルギー消費を30%削減
                this.energy -= energyDecayRate * energyDecayMultiplier;
                
                // 年齢を増加
                this.age++;
                
                // 時間による影響（昼夜サイクル）
                const dayPhase = (time % 240) / 240;
                const isNight = dayPhase > 0.5;
                const activityMultiplier = isNight ?
                    (this.dna.nocturnality) :
                    (1 - this.dna.nocturnality);
                
                // 深さに基づくストレス計算
                const depthStress = Math.abs(this.position.z - this.dna.depthPreference) / 
                    (10 * this.dna.depthTolerance);
                
                // 光合成によるエネルギー生成（捕食者は光合成効率が低い）
                if (this.dna.photosynthesis.efficiency > 0.2) {
                    // 深度に基づく効率計算
                    const depthDiff = Math.abs(this.position.z - this.dna.photosynthesis.depth.optimal);
                    const depthEfficiency = Math.max(0, 1 - (depthDiff / this.dna.photosynthesis.depth.range));
                    
                    // 時間帯による効率計算
                    const timeEfficiency = isNight ? 
                        this.dna.photosynthesis.adaptations.nightMode : 
                        1.0;
                    
                    // ストレス応答による効率計算
                    const stressResponse = Math.max(0.5, 1 - depthStress) * 
                        (this.dna.photosynthesis.adaptations.stressResponse || 0.5);
                    
                    // 総合効率
                    const totalEfficiency = depthEfficiency * timeEfficiency * stressResponse;
                    
                    // 捕食者は光合成効率が低下
                    const predatorPhotosynthesisMultiplier = this.isPredator ? 0.5 : 1.0;
                    
                    // 光合成によるエネルギー生成
                    const baseRate = 0.002;
                    this.energy += baseRate * totalEfficiency * predatorPhotosynthesisMultiplier;
                    
                    // 以下の重複コードを削除
                    // const photosynthesisEnergy = 0.001 * 
                    //     this.dna.photosynthesis.efficiency * 
                    //     depthEfficiency * 
                    //     timeEfficiency * 
                    //     stressResponse * 
                    //     predatorPhotosynthesisMultiplier;
                    // 
                    // this.energy += photosynthesisEnergy;
                }
                
                // 毒素関連の処理
                if (!this.isDead) {
                    // 毒素の生成と蓄積
                    const toxinProduction = (this.dna.toxins?.adaptation?.productionRate || 0.1) * 
                        (1 - this.energy * 0.5); // エネルギーが少ないと毒素生成が活発化
                    
                    // 各種毒素の強化/弱化
                    for (const toxinType of ['neural', 'cellular', 'digestive']) {
                        const currentStrength = this.dna.toxins?.types?.[toxinType]?.strength || 0.1;
                        const productionCost = this.dna.toxins?.types?.[toxinType]?.developmentCost || 0.3;
                        
                        // 毒素の強化（コストを消費）
                        if (this.energy > productionCost * 2) {
                            if (!this.dna.toxins) this.dna.toxins = { types: {} };
                            if (!this.dna.toxins.types) this.dna.toxins.types = {};
                            if (!this.dna.toxins.types[toxinType]) this.dna.toxins.types[toxinType] = {};
                            
                            this.dna.toxins.types[toxinType].strength = Math.min(
                                1.0,
                                currentStrength + toxinProduction * 0.1
                            );
                            this.energy -= productionCost * toxinProduction;
                        } else {
                            // エネルギーが少ない場合は毒素が弱化
                            if (this.dna.toxins?.types?.[toxinType]?.strength) {
                                this.dna.toxins.types[toxinType].strength *= 0.99;
                            }
                        }
                    }
                    
                    // 毒素耐性の適応的変化
                    for (const toxinType of ['neural', 'cellular', 'digestive']) {
                        if (this.energy > 0.5) {
                            // 高エネルギー状態では耐性が向上
                            if (!this.dna.toxins) this.dna.toxins = { resistance: {} };
                            if (!this.dna.toxins.resistance) this.dna.toxins.resistance = {};
                            
                            const currentResistance = this.dna.toxins.resistance[toxinType] || 0.1;
                            this.dna.toxins.resistance[toxinType] = Math.min(
                                1.0,
                                currentResistance + 0.001
                            );
                        } else {
                            // 低エネルギー状態では耐性が低下
                            if (this.dna.toxins?.resistance?.[toxinType]) {
                                this.dna.toxins.resistance[toxinType] *= 0.999;
                            }
                        }
                    }
                }
                
                // 成長
                if (this.size < this.maxSize) {
                    const growthRate = 0.0005 * this.dna.growthRate;
                    this.size += growthRate;
                    this.energy -= growthRate * 0.5;
                }
                
                // エネルギー消費（効率と活動時間帯に基づく）
                const mobilityFactor = this.dna.mobility * 0.01; // 移動能力が高いほどエネルギー消費も高い
                this.energy -= energyDecayRate * 
                    (1 - this.dna.efficiency * 0.01) * 
                    activityMultiplier * 
                    (1 + depthStress) *
                    (1 + mobilityFactor);
                
                // 自然回復
                this.energy += this.dna.regenerationRate * (1 - depthStress);
                this.energy = Math.min(this.energy, 1.0);
                
                // 移動能力に応じた行動の前に物理的な制約を適用
                if (this.dna.mobility > 0.1) {
                    // 重力の影響を追加（より穏やかに）
                    this.acceleration.z -= this.gravityStrength * 0.8;
                    
                    // 現在の速度の大きさを計算
                    const currentSpeed = Math.sqrt(
                        this.velocity.x * this.velocity.x +
                        this.velocity.y * this.velocity.y +
                        this.velocity.z * this.velocity.z
                    );
                    
                    // 空気抵抗の計算（より滑らかに）
                    if (currentSpeed > 0) {
                        const dragForce = this.dragCoefficient * currentSpeed;
                        const dragMultiplier = Math.max(0, 1 - dragForce / currentSpeed);
                        this.velocity.x *= dragMultiplier;
                        this.velocity.y *= dragMultiplier;
                        this.velocity.z *= dragMultiplier;
                    }
                    
                    // 既存の移動処理を継続（より滑らかに）
                    const interaction = this.interact(lifeforms, environment);
                    const boundaries = this.checkBoundaries();
                    const territory = this.defendTerritory(lifeforms);
                    
                    // 加速度の平滑化
                    const smoothAccel = {
                        x: this.lastAcceleration.x * this.accelerationSmoothing + 
                           (interaction.x + boundaries.x + territory.x) * (1 - this.accelerationSmoothing),
                        y: this.lastAcceleration.y * this.accelerationSmoothing + 
                           (interaction.y + boundaries.y + territory.y) * (1 - this.accelerationSmoothing),
                        z: this.lastAcceleration.z * this.accelerationSmoothing + 
                           (interaction.z + boundaries.z + territory.z) * (1 - this.accelerationSmoothing)
                    };
                    
                    // 力を適用（より滑らかに）
                    const movementMultiplier = this.dna.mobility * 
                        (this.dna.efficiency || 0.5) * 
                        Math.min(1.0, this.energy * 2);
                    
                    // 捕食者はより活発に動く
                    const predatorBonus = this.isPredator ? 1.5 : 1.0;
                    
                    this.acceleration.x = smoothAccel.x * movementMultiplier * this.turnRate * predatorBonus;
                    this.acceleration.y = smoothAccel.y * movementMultiplier * this.turnRate * predatorBonus;
                    this.acceleration.z = smoothAccel.z * movementMultiplier * this.turnRate * predatorBonus;
                    
                    // 前回の加速度を保存
                    this.lastAcceleration = smoothAccel;
                    
                    // 速度を更新（慣性を考慮）
                    this.velocity.x = this.velocity.x * this.inertia + this.acceleration.x;
                    this.velocity.y = this.velocity.y * this.inertia + this.acceleration.y;
                    this.velocity.z = this.velocity.z * this.inertia + this.acceleration.z;
                    
                    // 速度を制限（より滑らかに）
                    const speed = Math.sqrt(
                        this.velocity.x * this.velocity.x + 
                        this.velocity.y * this.velocity.y + 
                        this.velocity.z * this.velocity.z
                    );
                    
                    // 捕食者はより速く移動できる
                    const maxSpeed = this.isPredator ? 
                        0.8 * this.dna.speed * this.dna.mobility : 
                        0.5 * this.dna.speed * this.dna.mobility;
                    
                    if (speed > maxSpeed) {
                        const reduction = 1 - ((speed - maxSpeed) / speed) * 0.5;
                        this.velocity.x *= reduction;
                        this.velocity.y *= reduction;
                        this.velocity.z *= reduction;
                    }
                    
                    // 位置を更新
                    this.position.x += this.velocity.x;
                    this.position.y += this.velocity.y;
                    this.position.z += this.velocity.z;
                    
                    // 加速度をリセット
                    this.acceleration.x = 0;
                    this.acceleration.y = 0;
                    this.acceleration.z = 0;
                }
                
                // 繁殖判定
                if (this.energy > reproductionThreshold && Math.random() < this.dna.reproductionRate * 0.05) {
                    this.reproduce(lifeforms);
                }
                
                // 死亡判定
                if (this.energy <= 0 || this.age >= maxAge) {
                    this.isDead = true;
                }
                
                // 環境ノイズへの適応を更新
                this.updateEnvironmentalAdaptation(environment);
                
                // 交配による特殊能力の発現
                if (this.dna._matingOffspring) {
                    // 交配による子孫は遺伝子ハッキング能力が高い
                    if (!this.dna.toxins) this.dna.toxins = { types: {} };
                    if (!this.dna.toxins.types) this.dna.toxins.types = {};
                    if (!this.dna.toxins.types.genetic) {
                        this.dna.toxins.types.genetic = {
                            strength: 0.3,
                            developmentCost: 0.4,
                            effectRange: 2.0,
                            mutagenicPotential: 0.4
                        };
                    }
                    
                    // 成長に伴い遺伝子ハッキング能力が向上
                    if (this.age > 100 && Math.random() < 0.01) {
                        this.dna.toxins.types.genetic.strength *= 1.01;
                        this.dna.toxins.types.genetic.mutagenicPotential *= 1.01;
                        this.dna._geneticHackingPotential = (this.dna._geneticHackingPotential || 0.5) * 1.01;
                    }
                }
                
                // DNA修復システムを更新（一定確率で実行）
                if (Math.random() < 0.05) { // 5%の確率で実行
                    const repairResult = this.dnaRepairSystem.update();
                    
                    // 修復結果に基づいてフィードバック
                    if (repairResult.repaired > 0) {
                        // 修復成功のボーナス
                        this.energy += 0.01 * repairResult.repaired;
                    }
                }
            }
            
            // 認知階層システムを更新
            const cognitiveDecision = this.cognition.process(this, environment, lifeforms);
            
            // 認知的決定に基づいて行動を調整
            this.applyDecision(cognitiveDecision);
            
            // メタプログラミングシステムを更新
            const metaDecision = this.metaprogrammingSystem.update(environment, lifeforms);
            
            // メタプログラミングの決定に基づいて行動を調整
            if (metaDecision) {
                this.applyMetaDecision(metaDecision);
            }
            
            // 認知能力の発達を更新
            this.updateCognitiveAbilities();
            
            // 行動パターンを更新
            this.updateBehavior(lifeforms, environment);
            
            // 通信システムの更新
            this.communicationSystem.update(lifeforms);
        }
        
        // メタプログラミングの決定を適用
        applyMetaDecision(decision) {
            if (!decision || !decision.action) return;
            
            switch (decision.action) {
                case 'move_to_resource':
                    // リソースに向かう
                    if (decision.direction) {
                        this.acceleration.x += decision.direction.x;
                        this.acceleration.y += decision.direction.y;
                        this.acceleration.z += decision.direction.z;
                    }
                    
                    // 成功フィードバック
                    if (decision.target && this.getDistanceTo(decision.target) < 2.0) {
                        this.metaprogrammingSystem.provideFeedback('resourceGathering', true);
                    }
                    break;
                    
                case 'flee':
                    // 脅威から逃げる
                    if (decision.direction) {
                        this.acceleration.x += decision.direction.x * 1.5; // 緊急性を反映
                        this.acceleration.y += decision.direction.y * 1.5;
                        this.acceleration.z += decision.direction.z * 1.5;
                    }
                    
                    // 成功フィードバック（脅威との距離が増加した場合）
                    if (decision.threat && this.getDistanceTo(decision.threat.lifeform) > decision.threat.distance) {
                        this.metaprogrammingSystem.provideFeedback('predatorAvoidance', true);
                    }
                    break;
                    
                case 'approach_mate':
                    // 交配相手に近づく
                    if (decision.direction) {
                        this.acceleration.x += decision.direction.x;
                        this.acceleration.y += decision.direction.y;
                        this.acceleration.z += decision.direction.z;
                    }
                    break;
                    
                case 'attempt_mating':
                    // 交配を試みる
                    if (decision.target) {
                        const success = this.attemptMating(decision.target);
                        this.metaprogrammingSystem.provideFeedback('mating', success);
                    }
                    break;
                    
                case 'explore':
                    // 探索行動
                    if (decision.direction) {
                        this.acceleration.x += decision.direction.x * 0.8;
                        this.acceleration.y += decision.direction.y * 0.8;
                        this.acceleration.z += decision.direction.z * 0.8;
                    }
                    
                    // 新しい領域の探索は成功とみなす（単純化）
                    if (Math.random() < 0.1) {
                        this.metaprogrammingSystem.provideFeedback('exploration', true);
                    }
                    break;
                    
                default:
                    // その他の行動
                    break;
            }
        }
        
        // リソース検出時の処理を拡張
        detectResources(environment) {
            // 環境からリソースを検出する処理
            const resources = [];
            
            // 知覚範囲を計算
            const perceptionRadius = 15 * this.dna.perception;
            
            // 環境内のリソースを検索
            if (environment && environment.resources) {
                for (const [position, resourceMap] of environment.resources) {
                    const [x, y] = position.split(',').map(Number);
                    const dx = x - this.position.x;
                    const dy = y - this.position.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < perceptionRadius) {
                        for (const [type, amount] of resourceMap) {
                            resources.push({
                                type: type,
                                position: { x, y, z: 0 },
                                amount: amount,
                                distance: distance
                            });
                        }
                    }
                }
            }
            
            // 発見したリソースを記録
            if (resources.length > 0) {
                this.lastFoundResource = {
                    type: resources[0].type,
                    x: resources[0].position.x,
                    y: resources[0].position.y,
                    z: resources[0].position.z,
                    amount: resources[0].amount,
                    time: Date.now()
                };
            }
            
            return resources;
        }
        
        // 環境ノイズへの適応を更新
        updateEnvironmentalAdaptation(environment) {
            const now = Date.now();
            const timeDiff = (now - this.adaptationState.lastAdaptation) / 1000;
            
            // CPU負荷（温度）への適応
            const tempDiff = Math.abs(this.adaptationState.temperatureTolerance - environment.systemState.cpuLoad);
            if (tempDiff > 0.1) {
                const adaptationChange = Math.min(0.1, tempDiff * 0.05);
                this.adaptationState.temperatureTolerance += 
                    (environment.systemState.cpuLoad > this.adaptationState.temperatureTolerance) ? adaptationChange : -adaptationChange;
                this.energy -= this.adaptationCosts.temperature * adaptationChange;
            }
            
            // メモリ使用率（乱流）への適応
            const turbDiff = Math.abs(this.adaptationState.turbulenceResistance - environment.systemState.memoryUsage);
            if (turbDiff > 0.1) {
                const adaptationChange = Math.min(0.1, turbDiff * 0.05);
                this.adaptationState.turbulenceResistance += 
                    (environment.systemState.memoryUsage > this.adaptationState.turbulenceResistance) ? adaptationChange : -adaptationChange;
                this.energy -= this.adaptationCosts.turbulence * adaptationChange;
            }
            
            // ネットワークレイテンシー（視界）への適応
            const visualDiff = Math.abs(this.adaptationState.visualAdaptation - (1 - environment.systemState.networkLatency));
            if (visualDiff > 0.1) {
                const adaptationChange = Math.min(0.1, visualDiff * 0.05);
                this.adaptationState.visualAdaptation += 
                    ((1 - environment.systemState.networkLatency) > this.adaptationState.visualAdaptation) ? adaptationChange : -adaptationChange;
                this.energy -= this.adaptationCosts.visual * adaptationChange;
            }
            
            this.adaptationState.lastAdaptation = now;
        }
        
        // 縄張り防衛の行動を追加
        defendTerritory(lifeforms) {
            if (this.dna.territoriality < 0.2) return { x: 0, y: 0, z: 0 };
            
            let force = { x: 0, y: 0, z: 0 };
            let count = 0;
            
            const territoryRadius = 10 * this.dna.territoriality;
            
            for (const other of lifeforms) {
                if (other === this || other.isDead) continue;
                
                const dx = other.position.x - this.position.x;
                const dy = other.position.y - this.position.y;
                const dz = other.position.z - this.position.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                if (distance < territoryRadius) {
                    // 縄張り内の他の生物を追い払う
                    force.x -= dx * this.dna.territoriality;
                    force.y -= dy * this.dna.territoriality;
                    force.z -= dz * this.dna.territoriality;
                    count++;
                }
            }
            
            if (count > 0) {
                force.x /= count;
                force.y /= count;
                force.z /= count;
            }
            
            return force;
        }
        
        // DNAを3進数的な塩基配列に変換するメソッド
        encodeDNA() {
            const BASE_SYMBOLS = ['0', '1', '2'];  // 3種類の塩基記号
            const geneSequence = [];
            
            // バージョン情報
            geneSequence.push('V1');
            
            // 数値を3進数的な塩基配列に変換するヘルパー関数
            function encodeValue(value, length = 8) {
                // 0-1の値を0-255に変換
                const normalizedValue = Math.min(255, Math.max(0, Math.floor(value * 256)));
                let sequence = '';
                
                // 3進数的な表現に変換
                let remaining = normalizedValue;
                for (let i = 0; i < length; i++) {
                    const index = remaining % 3;
                    sequence = BASE_SYMBOLS[index] + sequence;
                    remaining = Math.floor(remaining / 3);
                }
                
                return sequence;
            }
            
            // 基本特性のエンコード
            geneSequence.push('BAS');
            [
                this.dna.speed || 0.5,
                this.dna.efficiency || 0.5,
                this.dna.perception || 0.5,
                this.dna.foodAttraction || 0.5,
                this.dna.socialBehavior || 0,
                this.dna.reproductionRate || 0.3,
                this.dna.predatory || 0.5,
                this.dna.size || 0.3
            ].forEach(value => {
                geneSequence.push(encodeValue(value));
            });
            
            // 光合成システムのエンコード
            geneSequence.push('PHO');
            geneSequence.push(encodeValue(this.dna.photosynthesis?.efficiency || 0.2));
            geneSequence.push(encodeValue((this.dna.photosynthesis?.depth?.optimal || 0) / 20 + 0.5)); // -10から10を0-1に正規化
            geneSequence.push(encodeValue(this.dna.photosynthesis?.depth?.range || 0.2));
            
            // 波長効率のエンコード
            (this.dna.photosynthesis?.wavelengths || []).forEach(wave => {
                geneSequence.push(encodeValue(wave?.efficiency || 0.2));
            });
            
            geneSequence.push(encodeValue(this.dna.photosynthesis?.adaptations?.nightMode || 0.1));
            geneSequence.push(encodeValue(this.dna.photosynthesis?.adaptations?.stressResponse || 0.2));
            
            // 毒素システムのエンコード
            geneSequence.push('TOX');
            ['neural', 'cellular', 'digestive'].forEach(type => {
                geneSequence.push(encodeValue(this.dna.toxins?.types?.[type]?.strength || 0.1));
                geneSequence.push(encodeValue(this.dna.toxins?.types?.[type]?.effectRange || 1.0));
            });
            
            // 抵抗性のエンコード
            geneSequence.push('RES');
            ['neural', 'cellular', 'digestive'].forEach(type => {
                geneSequence.push(encodeValue(this.dna.toxins?.resistance?.[type] || 0.1));
            });
            
            // その他の特性のエンコード
            geneSequence.push('OTH');
            [
                this.dna.mobility || 0.3,
                this.dna.growthRate || 0.2,
                this.dna.separationWeight || 0.3,
                this.dna.alignmentWeight || 0.2,
                this.dna.cohesionWeight || 0.2,
                this.dna.depthPreference || 0,
                this.dna.depthTolerance || 0.2,
                this.dna.regenerationRate || 0.05,
                this.dna.offspringCount || 1,
                this.dna.parentalCare || 0.1,
                this.dna.nocturnality || 0.4,
                this.dna.territoriality || 0.1
            ].forEach(value => {
                geneSequence.push(encodeValue(value));
            });
            
            return geneSequence.join('|');
        }
        
        // 3進数的な塩基配列からDNAを解読するメソッド
        static decodeDNA(sequence, mutationRate = 0.1) {
            try {
                const genes = sequence.split('|');
                let index = 0;
                
                // 3進数的な塩基配列から数値に変換するヘルパー関数
                function decodeValue(sequence) {
                    let value = 0;
                    for (let i = 0; i < sequence.length; i++) {
                        value = value * 3 + parseInt(sequence[i]);
                    }
                    // 突然変異の可能性
                    if (Math.random() < mutationRate) {
                        // ランダムな位置の塩基を変異させる
                        const pos = Math.floor(Math.random() * sequence.length);
                        const newBase = Math.floor(Math.random() * 3);
                        value = value + (newBase - parseInt(sequence[pos])) * Math.pow(3, sequence.length - pos - 1);
                    }
                    return value / 256; // 0-1の範囲に正規化
                }
                
                // バージョンチェック
                if (genes[index++] !== 'V1') {
                    throw new Error('Invalid DNA version');
                }
                
                const dna = {};
                
                // 基本特性のデコード
                if (genes[index++] === 'BAS') {
                    dna.speed = decodeValue(genes[index++]);
                    dna.efficiency = decodeValue(genes[index++]);
                    dna.perception = decodeValue(genes[index++]);
                    dna.foodAttraction = decodeValue(genes[index++]);
                    dna.socialBehavior = decodeValue(genes[index++]);
                    dna.reproductionRate = decodeValue(genes[index++]);
                    dna.predatory = decodeValue(genes[index++]);
                    dna.size = decodeValue(genes[index++]);
                }
                
                // 光合成システムのデコード
                if (genes[index++] === 'PHO') {
                    dna.photosynthesis = {
                        efficiency: decodeValue(genes[index++]),
                        depth: {
                            optimal: (decodeValue(genes[index++]) - 0.5) * 20, // 0-1から-10から10に逆正規化
                            range: decodeValue(genes[index++])
                        },
                        wavelengths: [],
                        adaptations: {
                            nightMode: decodeValue(genes[index + 3]),
                            stressResponse: decodeValue(genes[index + 4])
                        }
                    };
                    
                    // 波長効率のデコード
                    for (let i = 0; i < 3; i++) {
                        dna.photosynthesis.wavelengths.push({
                            min: 400 + i * 100,
                            max: 500 + i * 100,
                            efficiency: decodeValue(genes[index++])
                        });
                    }
                    index += 2; // adaptationsの分
                }
                
                // 毒素システムのデコード
                if (genes[index++] === 'TOX') {
                    dna.toxins = {
                        types: {
                            neural: { strength: decodeValue(genes[index++]), effectRange: decodeValue(genes[index++]) },
                            cellular: { strength: decodeValue(genes[index++]), effectRange: decodeValue(genes[index++]) },
                            digestive: { strength: decodeValue(genes[index++]), effectRange: decodeValue(genes[index++]) }
                        }
                    };
                }

                // 抵抗性のデコード
                if (genes[index++] === 'RES') {
                    if (!dna.toxins) dna.toxins = {};
                    dna.toxins.resistance = {
                        neural: decodeValue(genes[index++]),
                        cellular: decodeValue(genes[index++]),
                        digestive: decodeValue(genes[index++])
                    };
                    
                    // 適応システムの初期化
                    dna.toxins.adaptation = {
                        productionRate: Math.random() * 0.3,
                        storageCapacity: 0.5 + Math.random(),
                        releaseControl: Math.random()
                    };
                }
                
                // その他の特性のデコード
                if (genes[index++] === 'OTH') {
                    dna.mobility = decodeValue(genes[index++]);
                    dna.growthRate = decodeValue(genes[index++]);
                    dna.separationWeight = decodeValue(genes[index++]);
                    dna.alignmentWeight = decodeValue(genes[index++]);
                    dna.cohesionWeight = decodeValue(genes[index++]);
                    dna.depthPreference = (decodeValue(genes[index++]) - 0.5) * 20; // -10から10の範囲
                    dna.depthTolerance = decodeValue(genes[index++]);
                    dna.regenerationRate = decodeValue(genes[index++]);
                    dna.offspringCount = Math.max(1, Math.floor(decodeValue(genes[index++]) * 4)); // 1-4の範囲
                    dna.parentalCare = decodeValue(genes[index++]);
                    dna.nocturnality = decodeValue(genes[index++]);
                    dna.territoriality = decodeValue(genes[index++]);
                }
                
                // 遺伝子ネットワークは固定
                dna.geneNetwork = {
                    photosynthesis: {
                        enhancedBy: ['efficiency', 'regenerationRate'],
                        suppressedBy: ['toxins.adaptation.productionRate'],
                        influences: ['energy', 'growth']
                    },
                    toxins: {
                        enhancedBy: ['efficiency', 'size'],
                        suppressedBy: ['photosynthesis.efficiency'],
                        influences: ['predation', 'defense']
                    }
                };
                
                // ランダムな突然変異や欠落を導入
                Object.keys(dna).forEach(key => {
                    if (typeof dna[key] === 'number') {
                        if (Math.random() < mutationRate * 0.1) { // 完全な欠落
                            delete dna[key];
                        } else if (Math.random() < mutationRate) { // 変異
                            dna[key] *= 1 + (Math.random() * 0.4 - 0.2);
                        }
                    } else if (key === 'photosynthesis' && Math.random() < mutationRate * 0.05) {
                        // 光合成能力の重大な欠損
                        dna.photosynthesis.efficiency *= 0.1;
                        dna._requires_host = true; // 宿主依存フラグ
                    }
                });
                
                // エネルギー獲得に関する重要な機能の欠損をチェック
                if (!dna.photosynthesis || dna.photosynthesis.efficiency < 0.1) {
                    if (!dna.predatory || dna.predatory < 0.3) {
                        // 両方の主要なエネルギー獲得手段が欠損している場合
                        dna._requires_host = true;
                        dna._host_dependency = Math.random(); // 宿主への依存度
                    }
                }
                
                return dna;
            } catch (error) {
                console.error('DNA decoding error:', error);
                // エラーが発生した場合でも、部分的に解読できたDNAを使用
                // 解読できなかった部分はundefinedのまま
                return {
                    ...dna,  // 部分的に解読できた情報を保持
                    _decoding_error: true,  // エラーフラグを追加
                    _error_type: error.message  // エラー情報を保持
                };
            }
        }
        
        // 繁殖メソッドを更新
        reproduce(lifeforms) {
            if (lifeforms.length >= maxLifeforms) return;
            if (time - this.lastReproductionTime < 50) return;
            
            // 交配による繁殖を優先（最近交配した場合）
            if (this._lastMatingTime && time - this._lastMatingTime < 100) {
                // 交配後は通常の繁殖を抑制
                return;
            }
            
            // 宿主依存の個体の繁殖処理
            if (this.dna._requires_host) {
                if (!this._attached_host) return; // 宿主がいない場合は繁殖不可
                
                // 宿主のエネルギーを使って繁殖
                const hostEnergy = this._attached_host.energy;
                if (hostEnergy < 0.4) return; // 宿主のエネルギーが不足している場合は繁殖不可
                
                const energyCost = reproductionCost * 1.5; // 通常より高いエネルギーコスト
                this._attached_host.energy -= energyCost;
                
                // DNAを3進数的な塩基配列に変換
                const encodedDNA = this.encodeDNA();
                const childDna = Lifeform.decodeDNA(encodedDNA, mutationRate * 1.2); // より高い突然変異率
                
                // 子孫は必ず宿主依存
                childDna._requires_host = true;
                childDna._host_dependency = Math.min(1.0, (this.dna._host_dependency || 0.5) * (1 + (Math.random() - 0.5) * 0.2));
                
                const child = new Lifeform(
                    this.position.x + (Math.random() - 0.5) * 2,
                    this.position.y + (Math.random() - 0.5) * 2,
                    this.position.z + (Math.random() - 0.5) * 2,
                    energyCost * 0.5,
                    childDna
                );
                
                lifeforms.push(child);
                this.lastReproductionTime = time;
                return;
            }
            
            // 通常の繁殖処理（既存のコード）
            this.lastReproductionTime = time;
            
            const parentalInvestment = reproductionCost * (1 + this.dna.parentalCare);
            this.energy -= parentalInvestment;
            
            const offspringCount = this.dna.offspringCount || 1;
            const energyPerChild = (parentalInvestment * this.dna.parentalCare) / offspringCount;
            
            for (let i = 0; i < offspringCount; i++) {
                // DNAを3進数的な塩基配列に変換
                const encodedDNA = this.encodeDNA();
                
                // コードを解読して新しいDNAを生成（この過程で突然変異や欠落が発生する可能性がある）
                const childDna = Lifeform.decodeDNA(encodedDNA, mutationRate);
                
                // 遺伝子ハッキングの経験が繁殖に影響
                if (this._immune_response || this._acquiredGenes) {
                    // 遺伝子ハッキングの経験がある場合、子孫の防御または攻撃能力を強化
                    
                    if (this._immune_response) {
                        // 防御能力の強化
                        childDna.toxins = childDna.toxins || {};
                        childDna.toxins.resistance = childDna.toxins.resistance || {};
                        childDna.toxins.resistance.genetic = (childDna.toxins.resistance.genetic || 0.1) * 1.1;
                        
                        // 防御特化の特性
                        childDna._defensiveAdaptations = true;
                    }
                    
                    if (this._acquiredGenes && this._acquiredGenes.length > 0) {
                        // 攻撃能力の強化
                        childDna.toxins = childDna.toxins || {};
                        childDna.toxins.types = childDna.toxins.types || {};
                        childDna.toxins.types.genetic = childDna.toxins.types.genetic || {
                            strength: 0.2,
                            developmentCost: 0.5,
                            effectRange: 1.5,
                            mutagenicPotential: 0.3
                        };
                        
                        // 獲得した遺伝子の影響
                        childDna.toxins.types.genetic.strength *= 1.1;
                        childDna.toxins.types.genetic.mutagenicPotential *= 1.1;
                        
                        // 攻撃特化の特性
                        childDna._offensiveAdaptations = true;
                    }
                }
                
                const offsetDistance = 2 + (this.dna.parentalCare || 0.1) * 3;
                const offsetX = (Math.random() - 0.5) * offsetDistance;
                const offsetY = (Math.random() - 0.5) * offsetDistance;
                const offsetZ = (Math.random() - 0.5) * offsetDistance;
                
                const child = new Lifeform(
                    this.position.x + offsetX,
                    this.position.y + offsetY,
                    this.position.z + offsetZ,
                    0.3 + energyPerChild,
                    childDna
                );
                
                lifeforms.push(child);
            }
        }
        
        processMetabolism(environment) {
            if (this.isDead) return;

            const currentTime = time;
            if (currentTime - this.metabolicState.lastMetabolism < 10) return;
            this.metabolicState.lastMetabolism = currentTime;

            // 光合成による代謝産物生成（効率を調整）
            if (this.dna.photosynthesis?.efficiency > 0.2) {
                // 光合成効率を向上（0.1→0.15）
                const glucoseProduction = this.dna.photosynthesis.efficiency * 0.15;
                // 酸素生成比率を調整（0.5→0.6）
                const oxygenProduction = glucoseProduction * 0.6;
                
                environment.addResource(METABOLIC_PRODUCTS.GLUCOSE, this.position, glucoseProduction);
                environment.addResource(METABOLIC_PRODUCTS.OXYGEN, this.position, oxygenProduction);
                
                // 副産物としてアミノ酸の生成確率と量を調整
                if (Math.random() < 0.15) { // 確率を0.1から0.15に増加
                    environment.addResource(METABOLIC_PRODUCTS.AMINO_ACIDS, this.position, 0.08); // 量を0.05から0.08に増加
                }
                
                // エネルギーコストを追加
                this.energy -= glucoseProduction * 0.05; // 光合成にもわずかなエネルギーコスト
            }

            // 毒素生成（効率とコストのバランスを調整）
            if (this.dna.toxins?.adaptation?.productionRate > 0.3) {
                // 毒素生成量を調整（0.05→0.04）- 少し抑制
                const toxinProduction = this.dna.toxins.adaptation.productionRate * 0.04;
                
                // 主要な毒素タイプを判定
                let dominantToxin = 'neural';
                let maxStrength = this.dna.toxins?.types?.neural?.strength || 0;
                
                if ((this.dna.toxins?.types?.cellular?.strength || 0) > maxStrength) {
                    dominantToxin = 'cellular';
                    maxStrength = this.dna.toxins.types.cellular.strength;
                }
                if ((this.dna.toxins?.types?.digestive?.strength || 0) > maxStrength) {
                    dominantToxin = 'digestive';
                    maxStrength = this.dna.toxins.types.digestive.strength;
                }
                if ((this.dna.toxins?.types?.genetic?.strength || 0) > maxStrength) {
                    dominantToxin = 'genetic';
                    maxStrength = this.dna.toxins.types.genetic.strength;
                }
                
                environment.addResource(METABOLIC_PRODUCTS.TOXINS, this.position, toxinProduction, dominantToxin);
                // 毒素生成のエネルギーコストを増加（0.1→0.15）
                this.energy -= toxinProduction * 0.15;
            }

            // 周囲の資源を探索・消費（効率を調整）
            const nearbyResources = environment.getResources(this.position, 2);
            let totalResourceGain = 0;

            nearbyResources.forEach((amount, type) => {
                if (type === METABOLIC_PRODUCTS.GLUCOSE) {
                    // グルコースの消費効率を調整
                    const consumed = Math.min(amount, 0.12) * this.metabolicState.resourceEfficiency;
                    // グルコースからのエネルギー変換効率を向上
                    totalResourceGain += consumed * 1.2;
                    environment.addResource(type, this.position, -consumed);
                } else if (type === METABOLIC_PRODUCTS.AMINO_ACIDS) {
                    // アミノ酸の消費効率を調整
                    const consumed = Math.min(amount, 0.08) * this.metabolicState.resourceEfficiency;
                    // アミノ酸からのエネルギー変換効率を向上
                    totalResourceGain += consumed * 1.5;
                    environment.addResource(type, this.position, -consumed);
                    
                    // アミノ酸消費による成長促進効果
                    if (Math.random() < 0.2) {
                        this.dna.growthRate *= 1.001;
                    }
                }
            });

            this.energy = Math.min(1.0, this.energy + totalResourceGain);
            
            // 代謝廃棄物の生成
            if (totalResourceGain > 0) {
                environment.addResource(METABOLIC_PRODUCTS.WASTE, this.position, totalResourceGain * 0.3);
            }

            // デジタル代謝の処理を追加
            this.processDigitalMetabolism(environment);
            
            // エントロピー処理を追加
            this.processInformationEntropy(environment);
        }
        
        // デジタル代謝の処理（効率を調整）
        processDigitalMetabolism(environment) {
            // システム状態に応じてエネルギー効率を変動
            const systemLoad = environment.systemState.cpuLoad;
            const memoryState = environment.systemState.memoryUsage;
            
            // システム負荷が高いときは効率が下がる（調整）
            const efficiency = this.digitalMetabolism.cacheEfficiency * 
                (1 - systemLoad * 0.25) * // 0.3から0.25に軽減
                (1 - memoryState * 0.15);  // 0.2から0.15に軽減
            
            // エネルギー獲得に影響（調整）
            this.energy *= (1 + (efficiency - 0.5) * 0.12); // 0.1から0.12に増加
            
            // 廃棄物の蓄積と処理を改善
            this.digitalMetabolism.wasteAccumulation += 0.008; // 0.01から0.008に減少
            if (this.digitalMetabolism.wasteAccumulation > 1) {
                this.energy *= 0.96; // ペナルティを軽減（0.95→0.96）
                this.digitalMetabolism.wasteAccumulation = 0;
                
                // 廃棄物処理による副産物の生成
                if (Math.random() < 0.3) {
                    environment.addResource(METABOLIC_PRODUCTS.WASTE, this.position, 0.05);
                }
            }
            
            // データ処理量の更新（調整）
            this.digitalMetabolism.processedData += efficiency * 0.12; // 0.1から0.12に増加
        }
        
        // エントロピー処理
        processInformationEntropy(environment) {
            // システムの乱雑さに基づいてエントロピーを更新
            const systemChaos = (
                environment.systemState.cpuLoad + 
                environment.systemState.memoryUsage
            ) / 2;

            // エントロピーの変化（調整）
            this.informationState.entropy = 
                0.25 * this.informationState.entropy + // 0.3から0.25に減少
                0.75 * systemChaos; // 0.7から0.75に増加

            // 秩序度の更新
            this.informationState.orderLevel = 
                Math.max(0, 1 - this.informationState.entropy);

            // 生存への影響（調整）
            if (this.informationState.orderLevel < 0.2) {
                this.energy *= 0.985; // 低秩序のペナルティを軽減（0.98→0.985）
            }
            
            // 高い秩序度はボーナスを与える（調整）
            if (this.informationState.orderLevel > 0.8) {
                this.energy = Math.min(1.0, this.energy * 1.015); // ボーナスを増加（1.01→1.015）
            }
            
            // 栄養素バランスの影響を追加
            this.updateNutrientBalance();
        }
        
        // 栄養素バランスの更新メソッドを追加
        updateNutrientBalance() {
            const balance = this.metabolicState.nutrientBalance;
            
            // 栄養素バランスの自然な変動
            balance.glucose -= 0.01;
            balance.aminoAcids -= 0.005;
            balance.oxygen -= 0.008;
            
            // 下限を設定
            balance.glucose = Math.max(0, balance.glucose);
            balance.aminoAcids = Math.max(0, balance.aminoAcids);
            balance.oxygen = Math.max(0, balance.oxygen);
            
            // 栄養素バランスに基づくエネルギー効率の調整
            const totalBalance = balance.glucose + balance.aminoAcids + balance.oxygen;
            if (totalBalance < 0.5) {
                // 栄養素不足によるペナルティ
                this.energy *= 0.995;
            } else if (totalBalance > 0.8) {
                // 栄養素バランスが良好な場合のボーナス
                this.energy = Math.min(1.0, this.energy * 1.005);
            }
        }
        
        updateBehavior(lifeforms, environment) {
            // 引数がない場合の対応
            lifeforms = lifeforms || [];
            
            // 現在の状態評価
            const currentState = {
                energy: this.energy,
                threats: this.detectThreats(lifeforms),
                resources: this.detectResources(environment),
                companions: this.findCompatibleCompanions(lifeforms)
            };
            
            // 行動の結果を記録
            if (this.lastState) {
                const outcome = this.evaluateOutcome(this.lastState, currentState);
                this.updateBehaviorWeights(outcome);
            }
            
            this.lastState = currentState;
            
            // 適応的な群れ行動の重み付けを更新 (毎フレーム更新)
            this.dna.flockingBehavior = {
                separation: this.calculateAdaptiveSeparation(),
                alignment: this.calculateAdaptiveAlignment(),
                cohesion: this.calculateAdaptiveCohesion()
            };

            // 群れ行動の重みが小さすぎる場合、最小値を保証
            const minWeight = 0.15;
            if (this.dna.flockingBehavior.separation < minWeight) this.dna.flockingBehavior.separation = minWeight;
            if (this.dna.flockingBehavior.alignment < minWeight) this.dna.flockingBehavior.alignment = minWeight;
            if (this.dna.flockingBehavior.cohesion < minWeight) this.dna.flockingBehavior.cohesion = minWeight;
            
            // ログで重みを出力（デバッグ用、必要に応じてコメントアウト）
            /*
            if (Math.random() < 0.01) {
                console.log(`Flocking: sep=${this.dna.flockingBehavior.separation.toFixed(2)}, 
                             align=${this.dna.flockingBehavior.alignment.toFixed(2)}, 
                             coh=${this.dna.flockingBehavior.cohesion.toFixed(2)}`);
            }
            */
        }
        
        evaluateOutcome(previousState, currentState) {
            return {
                energyChange: currentState.energy - previousState.energy,
                threatLevel: currentState.threats.length,
                resourceAccess: this.evaluateResourceAccess(),
                socialBenefit: this.evaluateSocialInteractions()
            };
        }
        
        updateBehaviorWeights(outcome) {
            // 結果に基づいて行動パターンを調整
            if (outcome.energyChange > 0) {
                // 成功した行動パターンを強化
                this.reinforceBehavior();
            } else {
                // 失敗した行動パターンを弱化
                this.weakenBehavior();
            }
        }
        
        getDistanceTo(other) {
            const dx = other.position.x - this.position.x;
            const dy = other.position.y - this.position.y;
            const dz = other.position.z - this.position.z;
            return Math.sqrt(dx * dx + dy * dy + dz * dz);
        }
        
        // 遺伝子組み換えを行うメソッド
        crossover(partner) {
            const childDNA = {};
            
            // 基本的な特性の組み換え
            for (const key of ['speed', 'efficiency', 'perception', 'foodAttraction', 
                              'socialBehavior', 'reproductionRate', 'predatory', 'size']) {
                // 確率的に親のどちらかの特性を継承
                childDNA[key] = Math.random() < 0.5 ? this.dna[key] : partner.dna[key];
                
                // 低確率で両親の特性を混合
                if (Math.random() < 0.3 && typeof this.dna[key] === 'number' && typeof partner.dna[key] === 'number') {
                    childDNA[key] = (this.dna[key] + partner.dna[key]) / 2 + (Math.random() - 0.5) * 0.1;
                }
            }
            
            // 光合成システムの組み換え
            childDNA.photosynthesis = {
                efficiency: this.dna.photosynthesis.efficiency * 0.7 + 
                           partner.dna.photosynthesis.efficiency * 0.3,
                depth: {
                    optimal: (this.dna.photosynthesis?.depth?.optimal || 0) * 0.5 + 
                             (partner.dna.photosynthesis?.depth?.optimal || 0) * 0.5,
                    range: (this.dna.photosynthesis?.depth?.range || 0.2) * 0.5 + 
                           (partner.dna.photosynthesis?.depth?.range || 0.2) * 0.5
                },
                wavelengths: this.dna.photosynthesis.wavelengths.map((wave, i) => ({
                    min: wave.min,
                    max: wave.max,
                    efficiency: (wave.efficiency + partner.dna.photosynthesis.wavelengths[i].efficiency) / 2
                })),
                adaptations: {
                    nightMode: (this.dna.photosynthesis?.adaptations?.nightMode || 0.1) * 0.5 + 
                               (partner.dna.photosynthesis?.adaptations?.nightMode || 0.1) * 0.5,
                    stressResponse: (this.dna.photosynthesis?.adaptations?.stressResponse || 0.2) * 0.5 + 
                                    (partner.dna.photosynthesis?.adaptations?.stressResponse || 0.2) * 0.5
                }
            };
            
            // 毒素システムの組み換え
            if (this.dna.toxins || partner.dna.toxins) {
                childDNA.toxins = { types: {}, resistance: {} };
                
                // 毒素タイプの組み換え
                ['neural', 'cellular', 'digestive', 'genetic'].forEach(type => {
                    if (this.dna.toxins?.types?.[type] || partner.dna.toxins?.types?.[type]) {
                        childDNA.toxins.types[type] = {};
                        
                        // 強度の組み換え
                        const thisStrength = this.dna.toxins?.types?.[type]?.strength || 0.1;
                        const partnerStrength = partner.dna.toxins?.types?.[type]?.strength || 0.1;
                        childDNA.toxins.types[type].strength = Math.random() < 0.7 ? 
                            (thisStrength * 0.6 + partnerStrength * 0.4) : 
                            (thisStrength * 0.4 + partnerStrength * 0.6);
                        
                        // 効果範囲の組み換え
                        const thisRange = this.dna.toxins?.types?.[type]?.effectRange || 1.0;
                        const partnerRange = partner.dna.toxins?.types?.[type]?.effectRange || 1.0;
                        childDNA.toxins.types[type].effectRange = (thisRange + partnerRange) / 2;
                        
                        // その他のパラメータの組み換え
                        if (type === 'genetic') {
                            const thisCost = this.dna.toxins?.types?.genetic?.developmentCost || 0.5;
                            const partnerCost = partner.dna.toxins?.types?.genetic?.developmentCost || 0.5;
                            childDNA.toxins.types.genetic.developmentCost = (thisCost + partnerCost) / 2;
                            
                            const thisPotential = this.dna.toxins?.types?.genetic?.mutagenicPotential || 0.3;
                            const partnerPotential = partner.dna.toxins?.types?.genetic?.mutagenicPotential || 0.3;
                            childDNA.toxins.types.genetic.mutagenicPotential = (thisPotential + partnerPotential) / 2;
                        }
                    }
                });
                
                // 抵抗性の組み換え
                ['neural', 'cellular', 'digestive', 'genetic'].forEach(type => {
                    const thisResistance = this.dna.toxins?.resistance?.[type] || 0.1;
                    const partnerResistance = partner.dna.toxins?.resistance?.[type] || 0.1;
                    childDNA.toxins.resistance[type] = (thisResistance + partnerResistance) / 2;
                });
            }
            
            return childDNA;
        }

        calculateFitness() {
            // 基本的な生存能力
            let fitness = this.energy * 0.3;
            
            // 環境適応度
            const environmentalFitness = this.calculateEnvironmentalFitness();
            fitness += environmentalFitness * 0.2;
            
            // 社会的適応度
            const socialFitness = this.calculateSocialFitness();
            fitness += socialFitness * 0.15;
            
            // 代謝効率
            const metabolicFitness = this.calculateMetabolicFitness();
            fitness += metabolicFitness * 0.2;
            
            // 生殖成功度
            const reproductiveFitness = this.calculateReproductiveFitness();
            fitness += reproductiveFitness * 0.15;
            
            return fitness;
        }

        calculateAdaptiveSeparation() {
            // エネルギーと環境状況に基づいて分離の重みを適応的に計算
            let baseSeparation = this.dna.separationWeight || 0.3;
            
            // エネルギーが少ないほど分離を強くする（競争を避ける）
            const energyFactor = Math.max(0.5, 1.5 - this.energy);
            
            // 捕食者なら分離を弱める（集団で狩りをする）
            const predatorFactor = this.isPredator ? 0.8 : 1.2;
            
            return baseSeparation * energyFactor * predatorFactor;
        }
        
        calculateAdaptiveAlignment() {
            // 状況に応じて整列の重みを適応的に計算
            let baseAlignment = this.dna.alignmentWeight || 0.2;
            
            // エネルギーが多いほど整列を強くする（群れに従う余裕がある）
            const energyFactor = 0.5 + this.energy * 0.7;
            
            // 捕食者なら整列を強める（集団での狩りを促進）
            const predatorFactor = this.isPredator ? 1.3 : 0.9;
            
            return baseAlignment * energyFactor * predatorFactor;
        }
        
        calculateAdaptiveCohesion() {
            // 状況に応じて結合の重みを適応的に計算
            let baseCohesion = this.dna.cohesionWeight || 0.2;
            
            // エネルギーが少ないほど結合を弱める（個体で行動する）
            const energyFactor = this.energy < 0.3 ? 0.6 : 1.0;
            
            // 捕食者なら結合を強める（集団での狩りを促進）
            const predatorFactor = this.isPredator ? 1.2 : 0.9;
            
            return baseCohesion * energyFactor * predatorFactor;
        }

        // 周囲の脅威（捕食者など）を検出
        detectThreats(lifeforms) {
            const threats = [];
            // 知覚範囲を計算
            const perceptionRadius = 15 * this.dna.perception;
            
            for (const other of lifeforms) {
                if (other === this) continue;
                
                const dx = other.position.x - this.position.x;
                const dy = other.position.y - this.position.y;
                const dz = other.position.z - this.position.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                // 知覚範囲内で捕食者であれば脅威とみなす
                if (distance < perceptionRadius && other.isPredator && !this.isPredator) {
                    threats.push({
                        lifeform: other,
                        distance: distance
                    });
                }
            }
            
            return threats;
        }
        
        // 周囲の資源を検出
        detectResources(environment) {
            // 環境からリソースを検出する処理
            const resources = [];
            
            // 知覚範囲を計算
            const perceptionRadius = 15 * this.dna.perception;
            
            // 環境内のリソースを検索
            if (environment && environment.resources) {
                for (const [position, resourceMap] of environment.resources) {
                    const [x, y] = position.split(',').map(Number);
                    const dx = x - this.position.x;
                    const dy = y - this.position.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < perceptionRadius) {
                        for (const [type, amount] of resourceMap) {
                            resources.push({
                                type: type,
                                position: { x, y, z: 0 },
                                amount: amount,
                                distance: distance
                            });
                        }
                    }
                }
            }
            
            // 発見したリソースを記録
            if (resources.length > 0) {
                this.lastFoundResource = {
                    type: resources[0].type,
                    x: resources[0].position.x,
                    y: resources[0].position.y,
                    z: resources[0].position.z,
                    amount: resources[0].amount,
                    time: Date.now()
                };
            }
            
            return resources;
        }
        
        // 互換性のある仲間を探す
        findCompatibleCompanions(lifeforms) {
            const companions = [];
            // 知覚範囲を計算
            const perceptionRadius = 15 * this.dna.perception;
            
            for (const other of lifeforms) {
                if (other === this) continue;
                
                const dx = other.position.x - this.position.x;
                const dy = other.position.y - this.position.y;
                const dz = other.position.z - this.position.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                // 知覚範囲内で同じタイプ（捕食者か非捕食者か）であれば仲間とみなす
                if (distance < perceptionRadius && other.isPredator === this.isPredator) {
                    companions.push({
                        lifeform: other,
                        distance: distance
                    });
                }
            }
            
            return companions;
        }
        
        // 資源へのアクセス状況を評価
        evaluateResourceAccess() {
            // 簡易的な実装
            return Math.random(); // 0〜1の値を返す
        }
        
        // 社会的相互作用の利益を評価
        evaluateSocialInteractions() {
            // 簡易的な実装
            return Math.random(); // 0〜1の値を返す
        }
        
        // 行動を強化
        reinforceBehavior() {
            this.dna.cohesionWeight *= 1.01;
            this.dna.alignmentWeight *= 1.01;
        }
        
        // 行動を弱化
        weakenBehavior() {
            this.dna.cohesionWeight *= 0.99;
            this.dna.alignmentWeight *= 0.99;
        }
        
        applyDecision(decision) {
            // 認知的決定に基づいて行動を実行
            switch (decision.action) {
                case 'avoid_danger':
                    // 危険回避の行動
                    break;
                case 'seek_food':
                    // 食料探索の行動
                    break;
                case 'socialize':
                    // 社会的交流の行動
                    break;
                // その他の行動...
            }
        }
        
        updateCognitiveAbilities() {
            // 経験に基づいて認知能力を発達させる
            for (const level in this.cognition.development) {
                if (level !== 'reflexes' && level !== 'instincts') {
                    // 反射と本能以外は経験により発達
                    const maxDevelopment = this.dna.cognition.learningRate;
                    if (this.cognition.development[level] < maxDevelopment) {
                        this.cognition.development[level] += 0.0001;
                    }
                }
            }
            
            // 抽象思考能力の上限は DNA に依存
            if (this.cognition.development.abstractThinking > this.dna.cognition.abstractionCapacity) {
                this.cognition.development.abstractThinking = this.dna.cognition.abstractionCapacity;
            }
            
            // メタ認知能力の上限は DNA に依存
            if (this.cognition.development.metacognition > this.dna.cognition.metacognitionAbility) {
                this.cognition.development.metacognition = this.dna.cognition.metacognitionAbility;
            }
        }

        // 他の生命体との遺伝的距離を計算
        calculateGeneticDistance(other) {
            if (!other || !other.dna) return 1.0; // 最大距離
            
            // 比較する遺伝子特性のリスト
            const geneKeys = [
                'speed', 'efficiency', 'perception', 'foodAttraction', 
                'socialBehavior', 'reproductionRate', 'predatory', 'size',
                'metaprogrammingAbility', 'learningRate', 'creativity', 'adaptability'
            ];
            
            let totalDifference = 0;
            let comparedGenes = 0;
            
            // 基本的な数値特性の比較
            for (const key of geneKeys) {
                if (typeof this.dna[key] === 'number' && typeof other.dna[key] === 'number') {
                    const diff = Math.abs(this.dna[key] - other.dna[key]);
                    totalDifference += diff;
                    comparedGenes++;
                }
            }
            
            // 光合成能力の比較（もし存在すれば）
            if (this.dna.photosynthesis && other.dna.photosynthesis) {
                if (typeof this.dna.photosynthesis.efficiency === 'number' && 
                    typeof other.dna.photosynthesis.efficiency === 'number') {
                    const diff = Math.abs(this.dna.photosynthesis.efficiency - other.dna.photosynthesis.efficiency);
                    totalDifference += diff;
                    comparedGenes++;
                }
            }
            
            // 捕食者/被食者の互換性
            if (this.isPredator !== other.isPredator) {
                totalDifference += 1.0; // 捕食者と非捕食者は大きな遺伝的距離
                comparedGenes++;
            }
            
            // 平均差異を計算（0〜1の範囲）
            const averageDifference = comparedGenes > 0 ? totalDifference / comparedGenes : 1.0;
            
            // 同種族かどうかの判定に使用できる遺伝的距離を返す
            return Math.min(1.0, averageDifference);
        }
    }
    
    
    // Z-bufferを初期化
    function initZBuffer() {
        const buffer = [];
        for (let i = 0; i < width * height; i++) {
            buffer.push({
                char: ' ',
                depth: Infinity,
                color: ''
            });
        }
        return buffer;
    }
    
    // 生命体の状態に基づいて色を計算
    function getColor(lifeform) {
        // 生命体がnullまたはundefinedの場合のデフォルト色（より柔らかい青に）
        if (!lifeform || !lifeform.dna) {
            return 'hsl(180, 30%, 75%)';
        }

        // 死体の場合は分解段階に応じた色を返す
        if (lifeform.isDead) {
            // 主要な毒素タイプを判定
            let dominantToxin = 'neural';
            let maxStrength = lifeform.postMortemToxins?.neural || 0;
            
            if (lifeform.postMortemToxins?.cellular > maxStrength) {
                dominantToxin = 'cellular';
                maxStrength = lifeform.postMortemToxins.cellular;
            }
            if (lifeform.postMortemToxins?.digestive > maxStrength) {
                dominantToxin = 'digestive';
                maxStrength = lifeform.postMortemToxins.digestive;
            }
            
            // 分解の進行度を計算
            const decompositionProgress = (time - lifeform.deathTime) / lifeform.decompositionTime;
            
            // 毒素タイプに応じた色相を設定（より落ち着いた色に）
            let hue;
            switch (dominantToxin) {
                case 'neural':
                    hue = 280; // より落ち着いた紫色
                    break;
                case 'cellular':
                    hue = 15; // より落ち着いた赤褐色
                    break;
                case 'digestive':
                    hue = 45; // より落ち着いた黄土色
                    break;
                default:
                    hue = 260; // より落ち着いた紫色
            }
            
            // 毒素の強さに応じた彩度（より控えめに）
            const saturation = Math.min(40, 15 + (maxStrength * 25));
            
            // 分解の進行に応じた明度（より落ち着いた明度に）
            const lightness = Math.max(35, 65 - (decompositionProgress * 25));
            
            return `hsl(${hue}, ${Math.floor(saturation)}%, ${Math.floor(lightness)}%)`;
        }

        // 基本色相の計算（全体的により落ち着いた色調に）
        let hue = 190; // デフォルトをより落ち着いた青に
        // 彩度と明度の初期値を設定（より控えめに）
        let saturation = 35;
        let lightness = 60;
        
        // 光合成と捕食性による色相の調整
        const photoWeight = lifeform.dna.photosynthesis.efficiency;
        const predWeight = lifeform.dna.predatory;
        
        // 代謝経路の影響を追加（より控えめに）
        const metabolicComplexity = (lifeform.dna.metabolicPathways?.requiredResources?.length || 0) / 3;
        const metabolicHue = metabolicComplexity * 15;
        
        // リソース交換能力の影響を追加（より控えめに）
        const resourceExchangeEfficiency = 
            (lifeform.dna.resourceExchange?.giveRate || 0) +
            (lifeform.dna.resourceExchange?.receiveRate || 0);
        const exchangeHue = resourceExchangeEfficiency * 10;
        
        // 深度設定の影響を追加（より控えめに）
        const depthEffect = (lifeform.dna.depthPreference || 0) / 10;
        const depthHue = Math.abs(depthEffect) * 20;
        
        // 夜行性の影響を追加
        const nocturnalEffect = lifeform.dna.nocturnality || 0;
        
        // 捕食者の色をより落ち着いた赤に
        if (lifeform.isPredator) {
            hue = (15 + (predWeight * 15) + metabolicHue + exchangeHue) % 360;
            saturation = 45 + (predWeight * 15);
            lightness = 55 + (predWeight * 5) - (nocturnalEffect * 15);
        } else if (photoWeight > 0.5) {
            // 光合成能力が高い生命体はより落ち着いた緑系
            hue = (95 + (photoWeight * 20) + metabolicHue + depthHue) % 360;
            saturation = 35 + (Math.abs(depthEffect) * 15);
            lightness = 60 + (photoWeight * 10) - (nocturnalEffect * 10);
        } else {
            // その他はより落ち着いた青系
            hue = (190 + ((1 - predWeight) * 30) + exchangeHue + depthHue) % 360;
            saturation = 30 + (resourceExchangeEfficiency * 20);
            lightness = 65 - (nocturnalEffect * 15);
        }
        
        // 毒素による色相の微調整（より控えめに）
        const toxinStrength = (
            (lifeform.dna.toxins?.types?.neural?.strength || 0) +
            (lifeform.dna.toxins?.types?.cellular?.strength || 0) +
            (lifeform.dna.toxins?.types?.digestive?.strength || 0)
        ) / 3;
        hue += toxinStrength * 10;

        // 遺伝子ハッキングの視覚的表現（より控えめに）
        if (lifeform._geneExpressionModifiers && Object.keys(lifeform._geneExpressionModifiers).length > 0) {
            hue += 15;
            saturation += 10;
        }
        
        if (lifeform._immune_response) {
            hue -= 20;
            saturation += 5;
        }
        
        if (lifeform._acquiredGenes && lifeform._acquiredGenes.length > 0) {
            const recentAcquisition = lifeform._acquiredGenes.some(g => time - g.time < 100);
            if (recentAcquisition) {
                hue += 30;
                saturation += 10;
            }
        }
        
        // 攻撃/防御特化の視覚的表現（より控えめに）
        if (lifeform.dna._offensiveAdaptations) {
            hue = (hue + 15) % 360;
        }
        
        if (lifeform.dna._defensiveAdaptations) {
            hue = (hue + 195) % 360;
        }

        // 明度の調整（より落ち着いた範囲に）
        const energyFactor = lifeform.energy * 15;
        const ageFactor = Math.max(0, 10 - (lifeform.age / maxAge) * 10);
        lightness = Math.min(80, Math.max(45,
            lightness + energyFactor + ageFactor
        ));

        return `hsl(${Math.floor(hue)}, ${Math.floor(saturation)}%, ${Math.floor(lightness)}%)`;
    }
    
    // フレームを描画
    function render() {
        const zBuffer = initZBuffer();
        
        // 生命体が0になった場合のリスタート処理
        if (lifeforms.length === 0) {
            restartTimer++;
            if (restartTimer >= RESTART_DELAY) {
                console.log('生命体が絶滅したため、シミュレーションをリスタートします。');
                init();
                restartTimer = 0;
                return;
            }
        } else {
            restartTimer = 0;
        }
        
        // 生命体を更新
        for (let i = lifeforms.length - 1; i >= 0; i--) {
            lifeforms[i].processMetabolism(environment);
            // 完全に分解された場合のみ新しい生命体を生成
            if (lifeforms[i].update(lifeforms, environment)) {
                const deadPosition = { ...lifeforms[i].position };
                const deadEnergy = lifeforms[i].energy;
                
                if (Math.random() < 0.01) {  // 1%の確率で新しい生命体が発生
                    const newDna = {
                        ...lifeforms[i].dna,
                        // 突然変異を加える
                        photosynthesis: {
                            efficiency: Math.random(),
                            depth: {
                                optimal: (Math.random() * 10) - 5,
                                range: 0.2 + Math.random() * 0.3
                            },
                            wavelengths: [
                                { min: 400, max: 500, efficiency: Math.random() },
                                { min: 500, max: 600, efficiency: Math.random() },
                                { min: 600, max: 700, efficiency: Math.random() }
                            ],
                            adaptations: {
                                nightMode: Math.random() * 0.3,
                                stressResponse: Math.random() * 0.5
                            }
                        },
                        toxins: {
                            types: {
                                neural: {
                                    strength: Math.random() * 0.5,
                                    developmentCost: 0.3,
                                    effectRange: 2 + Math.random() * 3
                                },
                                cellular: {
                                    strength: Math.random() * 0.5,
                                    developmentCost: 0.4,
                                    effectRange: 1 + Math.random() * 2
                                },
                                digestive: {
                                    strength: Math.random() * 0.5,
                                    developmentCost: 0.2,
                                    effectRange: 1.5 + Math.random() * 2
                                }
                            },
                            resistance: {
                                neural: Math.random(),
                                cellular: Math.random(),
                                digestive: Math.random()
                            },
                            adaptation: {
                                productionRate: Math.random() * 0.3,
                                storageCapacity: 0.5 + Math.random(),
                                releaseControl: Math.random()
                            }
                        },
                        geneNetwork: {
                            photosynthesis: {
                                enhancedBy: ['efficiency', 'regenerationRate'],
                                suppressedBy: ['toxins.adaptation.productionRate'],
                                influences: ['energy', 'growth']
                            },
                            toxins: {
                                enhancedBy: ['efficiency', 'size'],
                                suppressedBy: ['photosynthesis.efficiency'],
                                influences: ['predation', 'defense']
                            }
                        },
                        mobility: Math.random(),
                        growthRate: 0.1 + Math.random() * 0.4,
                        size: 0.2 + Math.random() * 0.2,
                        speed: 0.3 + Math.random() * 0.2,
                        efficiency: 0.4 + Math.random() * 0.2,
                        perception: 0.3 + Math.random() * 0.2,
                        foodAttraction: 0.4 + Math.random() * 0.2,
                        socialBehavior: Math.random() * 0.4 - 0.2,
                        reproductionRate: 0.2 + Math.random() * 0.2,
                        separationWeight: 0.3 + Math.random() * 0.2,
                        alignmentWeight: 0.3 + Math.random() * 0.2,
                        cohesionWeight: 0.3 + Math.random() * 0.2,
                        depthPreference: (Math.random() * 10) - 5,
                        depthTolerance: 0.2 + Math.random() * 0.2,
                        regenerationRate: Math.random() * 0.05,
                        offspringCount: 1,
                        parentalCare: 0.1 + Math.random() * 0.2,
                        nocturnality: 0.4 + Math.random() * 0.2,
                        territoriality: Math.random() * 0.2,
                        
                        // DNAに以下のような特性を追加
                        resourceExchange: {
                            giveRate: Math.random(),      // リソースを提供する傾向
                            receiveRate: Math.random(),   // リソースを受け取る傾向
                            exchangeRange: Math.random(), // 交換可能な範囲
                            exchangeType: {              // 交換可能なリソースタイプ
                                energy: Math.random(),
                                nutrients: Math.random(),
                                protection: Math.random()
                            }
                        },
                        
                        metabolicPathways: {
                            wasteProducts: [],           // 代謝産物（他の生物のリソースになりうる）
                            requiredResources: [         // 必要な資源の初期設定
                                METABOLIC_PRODUCTS.GLUCOSE,
                                METABOLIC_PRODUCTS.OXYGEN
                            ],
                            byproducts: []              // 副産物（他の生物に有益または有害）
                        },
                        // flockingBehaviorの初期化
                        flockingBehavior: {
                            separation: 0.4 + Math.random() * 0.2,
                            alignment: 0.4 + Math.random() * 0.2,
                            cohesion: 0.4 + Math.random() * 0.2
                        },
                    };
                    
                    const offspring = new Lifeform(
                        deadPosition.x + (Math.random() - 0.5) * 3,
                        deadPosition.y + (Math.random() - 0.5) * 3,
                        deadPosition.z + (Math.random() - 0.5) * 2,
                        deadEnergy * 0.3,
                        newDna
                    );
                    
                    lifeforms.push(offspring);
                }
                
                lifeforms.splice(i, 1);
            }
        }
        
        // ネットワーク関係のある生命体を特定
        const networkedLifeforms = new Set();
        for (const lifeform of lifeforms) {
            if (lifeform.bonds && lifeform.bonds.size > 0) {
                networkedLifeforms.add(lifeform);
                lifeform.bonds.forEach((strength, other) => {
                    if (strength > 0.3) { // 一定以上の結合強度がある場合のみ
                        networkedLifeforms.add(other);
                    }
                });
            }
        }
        
        // 生命体を描画
        for (const lifeform of lifeforms) {
            const projectedX = Math.floor(lifeform.position.x);
            const projectedY = Math.floor(lifeform.position.y);
            const z = lifeform.position.z;
            
            if (projectedX >= 0 && projectedX < width && projectedY >= 0 && projectedY < height) {
                const bufferIndex = projectedY * width + projectedX;
                
                if (z < zBuffer[bufferIndex].depth) {
                    // サイズとエネルギーに基づいて文字を選択（安全に）
                    const size = lifeform.size || 0;
                    const energy = lifeform.energy || 0;
                    const sizeIndex = Math.min(Math.floor(size * (asciiChars.length - 1)), asciiChars.length - 1);
                    const energyIndex = Math.min(Math.floor(energy * (asciiChars.length - 1)), asciiChars.length - 1);
                    const charIndex = Math.max(0, Math.min(Math.max(sizeIndex, energyIndex), asciiChars.length - 1));
                    
                    // ネットワーク関係がある場合は特殊文字を使用
                    let displayChar;
                    if (networkedLifeforms.has(lifeform)) {
                        // フレーム数に基づいて通常の文字と特殊文字を交互に表示
                        if (time % 10 < 5) {
                            displayChar = asciiChars[charIndex] || '·';
                        } else {
                            // ランダムにネットワーク文字を選択
                            const networkIndex = Math.floor(Math.random() * networkChars.length);
                            displayChar = networkChars[networkIndex];
                        }
                    } else {
                        displayChar = asciiChars[charIndex] || '·';
                    }
                    
                    // 色の計算
                    const color = getColor(lifeform);
                    
                    zBuffer[bufferIndex] = {
                        char: displayChar,
                        depth: z,
                        color: color
                    };
                }
            }
        }
        
        // 環境リソースの情報を取得
        const resourceBuffer = Array(width * height).fill().map(() => new Map());
        
        // 環境グリッドからリソース情報を収集
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                const cell = environment.grid[x][y];
                if (cell) {
                    cell.forEach((amount, type) => {
                        if (amount > 0) {
                            resourceBuffer[y * width + x].set(type, amount);
                        }
                    });
                }
            }
        }
        
        // Z-bufferから文字列を生成
        let output = '';
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                const resources = resourceBuffer[index];
                
                if (zBuffer[index].char !== ' ') {
                    // 生命体の描画
                    output += `<span style="color:${zBuffer[index].color}">${zBuffer[index].char}</span>`;
                } else if (resources && resources.size > 0) {
                    // リソースの描画
                    let resourceChar = '·';
                    let resourceColor = '';
                    let maxAmount = 0;
                    let opacity = 0;
                    
                    // 最も量の多いリソースを特定
                    resources.forEach((amount, type) => {
                        if (amount > maxAmount) {
                            maxAmount = amount;
                            
                            // リソースタイプに基づいて色を設定
                            switch (type) {
                                case METABOLIC_PRODUCTS.OXYGEN:
                                    resourceColor = 'hsl(180, 100%, 30%)'; // 水色
                                    resourceChar = '░'; // 酸素は薄い網掛け
                                    break;
                                case METABOLIC_PRODUCTS.GLUCOSE:
                                    resourceColor = 'hsl(60, 100%, 30%)'; // 黄色
                                    resourceChar = '▒'; // グルコースは中程度の網掛け
                                    break;
                                case METABOLIC_PRODUCTS.AMINO_ACIDS:
                                    resourceColor = 'hsl(120, 100%, 30%)'; // 緑色
                                    resourceChar = '▒'; // アミノ酸も中程度の網掛け
                                    break;
                                case METABOLIC_PRODUCTS.WASTE:
                                    resourceColor = 'hsl(30, 70%, 30%)'; // 茶色
                                    resourceChar = '░'; // 廃棄物は薄い網掛け
                                    break;
                                case METABOLIC_PRODUCTS.TOXINS:
                                    resourceColor = 'hsl(300, 100%, 30%)'; // 紫色（デフォルト）
                                    resourceChar = '▒'; // 毒素は中程度の網掛け
                                    break;
                                default:
                                    // 毒素の種類に応じた色を設定
                                    if (type.startsWith(METABOLIC_PRODUCTS.TOXINS + '_')) {
                                        const toxinType = type.split('_')[1];
                                        switch (toxinType) {
                                            case 'neural':
                                                resourceColor = 'hsl(300, 100%, 30%)'; // 紫色（神経毒）
                                                break;
                                            case 'cellular':
                                                resourceColor = 'hsl(0, 100%, 30%)'; // 赤色（細胞毒）
                                                break;
                                            case 'digestive':
                                                resourceColor = 'hsl(60, 100%, 30%)'; // 黄色（消化器毒）
                                                break;
                                            case 'genetic':
                                                resourceColor = 'hsl(270, 100%, 30%)'; // 青紫色（遺伝子操作毒素）
                                                break;
                                            default:
                                                resourceColor = 'hsl(300, 100%, 30%)'; // デフォルト紫色
                                        }
                                        resourceChar = '▒'; // 毒素は中程度の網掛け
                                    } else {
                                        resourceColor = 'hsl(0, 0%, 30%)'; // グレー
                                        resourceChar = '░';
                                    }
                            }
                            
                            // 量に基づいて透明度を設定（最大0.7に制限して全体的に透明に）
                            opacity = Math.min(0.3, amount * 2);
                        }
                    });
                    
                    // 量が非常に少ない場合は表示しない（閾値を0.02に設定）
                    if (maxAmount < 0.02) {
                        output += '&nbsp;';
                    } else {
                        // リソース量に応じて表示する文字の大きさを調整
                        if (maxAmount > 0.3) {
                            // 量が多い場合は、リソースタイプに応じた特殊文字をそのまま使用
                            opacity = Math.min(0.3, opacity); // 最大透明度を0.6に制限
                        } else if (maxAmount > 0.1) {
                            // 量が中程度の場合は薄い網掛け
                            resourceChar = '░';
                            opacity = Math.min(0.3, opacity); // 最大透明度を0.4に制限
                        } else {
                            // 量が少ない場合はさらに薄く
                            resourceChar = '·';
                            opacity = Math.min(0.3, opacity); // 最大透明度を0.3に制限
                        }
                        
                        // 透明度を適用した色を生成
                        const rgbaColor = `rgba(${hslToRgb(resourceColor)}, ${opacity})`;
                        output += `<span style="color:${rgbaColor}">${resourceChar}</span>`;
                    }
                } else {
                    output += '&nbsp;';
                }
            }
            output += '<br>';
        }
        
        // キャンバスに描画
        canvas.innerHTML = output;
        
        // 次のフレーム
        time += 1;
        
        // 統計情報を表示（デバッグ用）
        if (time % 60 === 0) {
            const predatorCount = lifeforms.filter(l => l.isPredator).length;
            const preyCount = lifeforms.length - predatorCount;
            console.log(`Time: ${time}, Lifeforms: ${lifeforms.length} (Predators: ${predatorCount}, Prey: ${preyCount})`);
        }
        
        // FPS制限を実装（30FPS）
        setTimeout(() => {
            requestAnimationFrame(render);
        }, 1000 / 10); // 30FPSに制限
        
        // 生命体の描画
        for (let i = 0; i < lifeforms.length; i++) {
            const lifeform = lifeforms[i];
            
            // ... 既存のコード ...
            
            // メタプログラミング能力の視覚化
            if (lifeform.metaprogrammingSystem) {
                // メタプログラミング能力が高い生命体は特別な輝きを持つ
                const metaAbility = lifeform.dna.metaprogrammingAbility || 0;
                if (metaAbility > 0.7) {
                    // 高度なメタプログラミング能力を持つ生命体は特別なパターンで表示
                    const patternChar = '⚙'; // 歯車マーク
                    const x = Math.floor(lifeform.position.x);
                    const y = Math.floor(lifeform.position.y);
                    
                    if (x >= 0 && x < width && y >= 0 && y < height) {
                        // 生命体の周囲にパターンを描画
                        const patternRadius = 1;
                        for (let px = -patternRadius; px <= patternRadius; px++) {
                            for (let py = -patternRadius; py <= patternRadius; py++) {
                                const patternX = x + px;
                                const patternY = y + py;
                                
                                if (patternX >= 0 && patternX < width && patternY >= 0 && patternY < height &&
                                    (px !== 0 || py !== 0) && // 中心は除外
                                    Math.random() < metaAbility * 0.3) { // 確率で表示
                                    
                                    // 深度に基づいて表示するかどうか判断
                                    const patternZ = lifeform.position.z + (Math.random() - 0.5) * 2;
                                    if (patternZ > zBuffer[patternY][patternX]) {
                                        // パターンを描画
                                        const patternColor = getColor(lifeform);
                                        patternColor.s = 0.8; // 彩度を上げる
                                        patternColor.l = 0.7; // 明度を上げる
                                        
                                        // 最適化中のアルゴリズムがある場合は色を変える
                                        if (lifeform.metaprogrammingSystem.currentOptimizationTarget) {
                                            patternColor.h = (patternColor.h + 180) % 360; // 補色
                                        }
                                        
                                        const patternRgb = hslToRgb(patternColor);
                                        const patternStyle = `color: rgb(${patternRgb.r}, ${patternRgb.g}, ${patternRgb.b})`;
                                        
                                        display[patternY][patternX] = {
                                            char: patternChar,
                                            style: patternStyle,
                                            z: patternZ
                                        };
                                        
                                        zBuffer[patternY][patternX] = patternZ;
                                    }
                                }
                            }
                        }
                    }
                }
                
                // 最適化履歴の分析
                const optimizationHistory = lifeform.metaprogrammingSystem.optimizationHistory;
                if (optimizationHistory.length > 0) {
                    // 最近の最適化を取得
                    const recentOptimizations = optimizationHistory.slice(-5);
                    
                    // 最適化の成功率を計算
                    const successfulOptimizations = recentOptimizations.filter(opt => 
                        opt.successRate > 0.6
                    ).length;
                    
                    const optimizationSuccessRate = successfulOptimizations / Math.max(1, recentOptimizations.length);
                    
                    // 成功率が高い場合は生命体の色を少し変える
                    if (optimizationSuccessRate > 0.7) {
                        // 色相を少し変える
                        lifeform.baseHue = (lifeform.baseHue + 10) % 360;
                    }
                }
            }
        }
    }
    
    // HSL色をRGBに変換するヘルパー関数
    function hexToRgb(hslColor) {
        // 一時的なdiv要素を作成して色変換を行う
        const tempDiv = document.createElement('div');
        tempDiv.style.color = hslColor;
        document.body.appendChild(tempDiv);
        
        // 計算された色を取得
        const computedColor = window.getComputedStyle(tempDiv).color;
        document.body.removeChild(tempDiv);
        
        // "rgb(r, g, b)" または "rgba(r, g, b, a)" 形式から数値部分を抽出
        const rgbMatch = computedColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
        if (rgbMatch) {
            return `${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}`;
        }
        
        // 変換できない場合はデフォルト値を返す
        return '200, 200, 200';
    }
    
    // HSL色をRGBに変換するヘルパー関数（数学的計算による方法）
    function hslToRgb(hslColor) {
        // HSL形式の文字列から値を抽出
        const hslMatch = hslColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
        if (!hslMatch) {
            return '200, 200, 200'; // デフォルト値
        }
        
        // HSL値を取得
        let h = parseInt(hslMatch[1]) / 360;
        let s = parseInt(hslMatch[2]) / 100;
        let l = parseInt(hslMatch[3]) / 100;
        
        let r, g, b;
        
        if (s === 0) {
            // 彩度が0の場合はグレースケール
            r = g = b = l;
        } else {
            // HSLからRGBへの変換
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        
        // 0-255の範囲に変換
        r = Math.round(r * 255);
        g = Math.round(g * 255);
        b = Math.round(b * 255);
        
        return `${r}, ${g}, ${b}`;
    }
    
    // アニメーション開始（environmentインスタンス作成後に呼び出し）
    render();
    
    // ウィンドウサイズ変更時の処理
    window.addEventListener('resize', () => {
        const fontWidth = Math.floor(window.innerWidth / width);
        const fontHeight = Math.floor(window.innerHeight / height);
        const fontSize = Math.min(fontWidth, fontHeight);
        canvas.style.fontSize = `${fontSize}px`;
    });
    
    // 初期フォントサイズ設定
    const fontWidth = Math.floor(window.innerWidth / width);
    const fontHeight = Math.floor(window.innerHeight / height);
    const fontSize = Math.min(fontWidth, fontHeight);
    canvas.style.fontSize = `${fontSize}px`;
    
    function init() {
        // 環境が初期化されていない場合は初期化
        if (!environment) {
            environment = new Environment();
        }
        
        // 初期生命体を生成
        lifeforms = initializeLifeforms();
        
        // 環境に初期リソースを追加
        for (let i = 0; i < width; i++) {
            for (let j = 0; j < height; j++) {
                // ランダムな確率で栄養素を配置（確率を15%から5%に大幅減少）
                if (Math.random() < 0.05) {  // 5%の確率で配置
                    // グルコースの量をさらに減少（0.3から0.15に）
                    const glucoseAmount = Math.max(0, 
                        (Math.random() + Math.random() + Math.random()) / 3 * 0.15
                    );
                    
                    // 酸素の量も同様に減少
                    const oxygenAmount = Math.max(0,
                        (Math.random() + Math.random() + Math.random()) / 3 * 0.15
                    );
                    
                    // 最小閾値をさらに下げる
                    if (glucoseAmount > 0.02) {
                        environment.addResource(
                            METABOLIC_PRODUCTS.GLUCOSE,
                            {x: i, y: j},
                            glucoseAmount
                        );
                    }
                    
                    if (oxygenAmount > 0.02) {
                        environment.addResource(
                            METABOLIC_PRODUCTS.OXYGEN,
                            {x: i, y: j},
                            oxygenAmount
                        );
                    }
                }
            }
        }
        
        // クラスター数をさらに減少させ、サイズも縮小
        for (let cluster = 0; cluster < 2; cluster++) {  // 3から2に減少
            const centerX = Math.random() * width;
            const centerY = Math.random() * height;
            const radius = 2 + Math.random() * 4;  // 半径を3-10から2-6に減少
            
            for (let i = -radius; i <= radius; i++) {
                for (let j = -radius; j <= radius; j++) {
                    const x = Math.floor(centerX + i);
                    const y = Math.floor(centerY + j);
                    
                    if (x >= 0 && x < width && y >= 0 && y < height) {
                        const dist = Math.sqrt(i * i + j * j);
                        if (dist <= radius) {
                            const factor = 1 - (dist / radius);
                            environment.addResource(
                                METABOLIC_PRODUCTS.GLUCOSE,
                                {x, y},
                                factor * 0.15 * Math.random()  // 0.3から0.15に減少
                            );
                            environment.addResource(
                                METABOLIC_PRODUCTS.OXYGEN,
                                {x, y},
                                factor * 0.15 * Math.random()  // 0.3から0.15に減少
                            );
                        }
                    }
                }
            }
        }
        
        // レンダリング開始
        requestAnimationFrame(render);
    }
    
    // 生命体の初期化関数
    function initializeLifeforms() {
        const newLifeforms = [];  // 新しい配列を作成
        
        // 捕食者と非捕食者のバランスを調整
        const predatorRatio = 0.3; // 30%を捕食者に
        
        // 生命体の数を指定
        const lifeformCount = 50;
        
        for (let i = 0; i < lifeformCount; i++) {
            // 捕食者かどうかを決定
            const isPredator = Math.random() < predatorRatio;
            
            // DNAを生成（完全な形で）
            const dna = {
                // 基本的な特性
                speed: 0.5 + Math.random() * 0.5,
                efficiency: 0.7 + Math.random() * 0.4,
                perception: 0.6 + Math.random() * 0.6,
                foodAttraction: 0.8 + Math.random() * 0.8,
                socialBehavior: Math.random() * 2 - 1,
                reproductionRate: 0.3 + Math.random() * 0.7,
                predatory: isPredator ? 0.7 + Math.random() * 0.3 : Math.random() * 0.5,
                size: 0.3 + Math.random() * 0.7,
                
                // 光合成システム（必須）
                photosynthesis: {
                    efficiency: 0.2 + Math.random() * 0.2,
                    depth: {
                        optimal: (Math.random() * 10) - 5,
                        range: 0.2 + Math.random() * 0.3
                    },
                    wavelengths: [
                        { min: 400, max: 500, efficiency: Math.random() },
                        { min: 500, max: 600, efficiency: Math.random() },
                        { min: 600, max: 700, efficiency: Math.random() }
                    ],
                    adaptations: {
                        nightMode: Math.random() * 0.3,
                        stressResponse: Math.random() * 0.5
                    }
                },
                
                // 毒素システム
                toxins: {
                    types: {
                        neural: {
                            strength: 0.1 + Math.random() * 0.2,
                            developmentCost: 0.3,
                            effectRange: 2 + Math.random() * 3
                        },
                        cellular: {
                            strength: 0.1 + Math.random() * 0.2,
                            developmentCost: 0.4,
                            effectRange: 1 + Math.random() * 2
                        },
                        digestive: {
                            strength: 0.1 + Math.random() * 0.2,
                            developmentCost: 0.2,
                            effectRange: 1.5 + Math.random() * 2
                        }
                    },
                    resistance: {
                        neural: 0.1 + Math.random() * 0.2,
                        cellular: 0.1 + Math.random() * 0.2,
                        digestive: 0.1 + Math.random() * 0.2
                    },
                    adaptation: {
                        productionRate: Math.random() * 0.3,
                        storageCapacity: 0.5 + Math.random(),
                        releaseControl: Math.random()
                    }
                },
                
                // その他の必須属性
                mobility: isPredator ? 0.7 + Math.random() * 0.3 : Math.random(),
                growthRate: 0.1 + Math.random() * 0.4,
                separationWeight: 0.3 + Math.random() * 0.2,
                alignmentWeight: 0.3 + Math.random() * 0.2,
                cohesionWeight: 0.3 + Math.random() * 0.2,
                depthPreference: (Math.random() * 10) - 5,
                depthTolerance: 0.2 + Math.random() * 0.2,
                regenerationRate: Math.random() * 0.05,
                offspringCount: 1,
                parentalCare: 0.1 + Math.random() * 0.2,
                nocturnality: 0.4 + Math.random() * 0.2,
                territoriality: Math.random() * 0.2
            };
            
            // 生命体を生成
            // 中央付近に集中して配置
            const centerX = width / 2;
            const centerY = height / 2;
            const radius = 10; // 集中エリアの半径
            
            // 捕食者と非捕食者で異なる配置を行う
            let x, y;
            if (isPredator) {
                // 捕食者は外周に配置
                const angle = (Math.PI * 2 * i) / lifeformCount;
                x = centerX + Math.cos(angle) * radius;
                y = centerY + Math.sin(angle) * radius;
            } else {
                // 非捕食者は中心付近にランダムに配置
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.random() * (radius * 0.6); // 中心から60%以内の範囲
                x = centerX + Math.cos(angle) * distance;
                y = centerY + Math.sin(angle) * distance;
            }
            
            // z座標は少し狭い範囲に
            const z = (Math.random() * 10) - 5;
            const energy = 0.8 + Math.random() * 0.2;
            
            newLifeforms.push(new Lifeform(x, y, z, energy, dna));
        }
        
        return newLifeforms;
    }
    
    // シミュレーション開始
    init();
}); 

class EpigeneticState {
    constructor() {
        this.methylationPatterns = new Map();
        this.histoneModifications = new Map();
        this.environmentalStress = 0;
    }
    
    updateMethylation(gene, stress) {
        // 環境ストレスに基づいて遺伝子の発現を調整
        const currentPattern = this.methylationPatterns.get(gene) || 1.0;
        const newPattern = Math.max(0, Math.min(1, currentPattern + stress * 0.1));
        this.methylationPatterns.set(gene, newPattern);
    }
    
    getGeneExpression(gene) {
        // メチル化パターンに基づいて遺伝子発現レベルを返す
        return this.methylationPatterns.get(gene) || 1.0;
    }
} 

class Species {
    constructor(prototype) {
        this.prototype = prototype;
        this.members = new Set();
        this.geneticSignature = this.calculateGeneticSignature(prototype);
        this.age = 0;
        this.lastDivergenceTime = 0;
    }
    
    calculateGeneticDistance(lifeform) {
        let distance = 0;
        const weights = {
            photosynthesis: 0.3,
            predatory: 0.3,
            size: 0.2,
            metabolicPathways: 0.2
        };
        
        // 各特性の差異を重み付けして計算
        for (const [trait, weight] of Object.entries(weights)) {
            const diff = Math.abs(this.prototype.dna[trait] - lifeform.dna[trait]);
            distance += diff * weight;
        }
        
        return distance;
    }
    
    checkSpeciation(lifeform) {
        const geneticDistance = this.calculateGeneticDistance(lifeform);
        const speciationThreshold = 0.3;
        
        // 遺伝的距離が閾値を超えた場合、新種として分岐
        if (geneticDistance > speciationThreshold) {
            return new Species(lifeform);
        }
        return null;
    }
} 

class LifeformManager {
    constructor() {
        this.species = new Set();
        this.speciesHistory = [];
        this.divergenceEvents = [];
    }
    
    updateSpecies(lifeforms) {
        // 既存の種を更新
        for (const species of this.species) {
            species.members.clear();
        }
        
        // 各生命体を適切な種に分類
        for (const lifeform of lifeforms) {
            let foundSpecies = false;
            
            for (const species of this.species) {
                if (species.calculateGeneticDistance(lifeform) < 0.3) {
                    species.members.add(lifeform);
                    foundSpecies = true;
                    break;
                }
            }
            
            // 新種の形成
            if (!foundSpecies) {
                const newSpecies = new Species(lifeform);
                this.species.add(newSpecies);
                this.divergenceEvents.push({
                    time: time,
                    parentSpecies: null,
                    newSpecies: newSpecies
                });
            }
        }
        
        // 種の絶滅をチェック
        for (const species of this.species) {
            if (species.members.size === 0) {
                this.species.delete(species);
                this.speciesHistory.push({
                    species: species,
                    extinctionTime: time
                });
            }
        }
    }
} 

class DecisionSystem {
    constructor() {
        this.memories = [];
        this.behaviorWeights = {
            exploration: 0.5,
            socialInteraction: 0.5,
            resourceGathering: 0.5,
            defense: 0.5
        };
        this.learningRate = 0.1;
    }

    makeDecision(currentState, environment) {
        // 過去の経験と現在の状態に基づいて意思決定
        const decision = {
            action: null,
            confidence: 0
        };

        // 状態評価
        const stateEvaluation = this.evaluateState(currentState);
        
        // 行動選択（各行動の期待値を計算）
        const actions = this.getPossibleActions(currentState);
        for (const action of actions) {
            const expectedValue = this.calculateExpectedValue(action, stateEvaluation);
            if (expectedValue > decision.confidence) {
                decision.action = action;
                decision.confidence = expectedValue;
            }
        }

        return decision;
    }

    learn(action, outcome) {
        // 結果に基づいて重みを更新
        const reward = this.calculateReward(outcome);
        this.updateWeights(action, reward);
        this.memories.push({action, outcome, reward});
        
        // 古い記憶を削除
        if (this.memories.length > 100) {
            this.memories.shift();
        }
    }
} 

class HomeostasisSystem {
    constructor() {
        this.parameters = {
            temperature: 0.5,
            pH: 0.5,
            osmolicBalance: 0.5,
            energyBalance: 0.5
        };
        this.optimalRanges = {
            temperature: {min: 0.4, max: 0.6},
            pH: {min: 0.45, max: 0.55},
            osmolicBalance: {min: 0.4, max: 0.6},
            energyBalance: {min: 0.3, max: 0.7}
        };
    }

    regulate() {
        let stress = 0;
        for (const [param, value] of Object.entries(this.parameters)) {
            const range = this.optimalRanges[param];
            if (value < range.min || value > range.max) {
                // ストレス応答を生成
                stress += Math.abs(value - (range.max + range.min) / 2);
                // 修正アクションを生成
                this.generateCorrectiveAction(param, value, range);
            }
        }
        return stress;
    }
} 

class EvolutionaryLearning {
    constructor() {
        this.adaptations = new Map();
        this.fitnessHistory = [];
        this.generationCount = 0;
    }

    adapt(environment, stress) {
        // 環境要因に基づいて適応を生成
        for (const [factor, value] of Object.entries(environment)) {
            const currentAdaptation = this.adaptations.get(factor) || 0;
            const adaptationChange = this.calculateAdaptationChange(value, stress);
            this.adaptations.set(factor, currentAdaptation + adaptationChange);
        }
    }

    calculateFitness() {
        let fitness = 0;
        for (const [factor, adaptation] of this.adaptations) {
            fitness += this.evaluateAdaptation(factor, adaptation);
        }
        this.fitnessHistory.push({
            generation: this.generationCount,
            fitness: fitness
        });
        return fitness;
    }
} 

class CognitiveHierarchy {
    constructor() {
        // 各レベルの活性化状態
        this.levels = {
            reflexes: { active: true, priority: 1.0 },
            instincts: { active: true, priority: 0.9 },
            learnedBehaviors: { active: true, priority: 0.8 },
            tacticalThinking: { active: true, priority: 0.7 },
            strategicThinking: { active: true, priority: 0.6 },
            socialThinking: { active: true, priority: 0.5 },
            abstractThinking: { active: true, priority: 0.4 },
            metacognition: { active: true, priority: 0.3 }
        };
        
        // 各レベルのエネルギーコスト
        this.energyCosts = {
            reflexes: 0.001,
            instincts: 0.002,
            learnedBehaviors: 0.005,
            tacticalThinking: 0.01,
            strategicThinking: 0.02,
            socialThinking: 0.03,
            abstractThinking: 0.04,
            metacognition: 0.05
        };
        
        // 各レベルの発達度
        this.development = {
            reflexes: 1.0,  // 反射は生まれつき完全に発達
            instincts: 0.8, // 本能もほぼ発達
            learnedBehaviors: 0.2, // 学習行動は経験により発達
            tacticalThinking: 0.1,
            strategicThinking: 0.05,
            socialThinking: 0.1,
            abstractThinking: 0.02,
            metacognition: 0.01
        };
        
        // 思考の履歴
        this.thoughtHistory = [];
        
        // 創発的特性の追跡
        this.emergentProperties = {
            creativity: 0,
            adaptability: 0,
            consciousness: 0
        };
    }
    
    // 各レベルの思考プロセスを実行
    process(lifeform, environment, others) {
        const results = {};
        let totalInfluence = 0;
        
        // エネルギーが少ない場合は高次の思考を制限
        this.adjustActiveLevels(lifeform.energy);
        
        // 各レベルの処理を実行
        if (this.levels.reflexes.active) {
            results.reflexes = this.processReflexes(lifeform, environment);
            totalInfluence += results.reflexes.influence * this.levels.reflexes.priority;
            lifeform.energy -= this.energyCosts.reflexes;
        }
        
        if (this.levels.instincts.active) {
            results.instincts = this.processInstincts(lifeform, environment);
            totalInfluence += results.instincts.influence * this.levels.instincts.priority;
            lifeform.energy -= this.energyCosts.instincts;
        }
        
        // 以下同様に各レベルの処理を実行...
        
        // 思考履歴に追加
        this.thoughtHistory.push({
            time: Date.now(),
            results: results,
            energy: lifeform.energy
        });
        
        // 履歴が長すぎる場合は古いものを削除
        if (this.thoughtHistory.length > 100) {
            this.thoughtHistory.shift();
        }
        
        // 創発的特性の更新
        this.updateEmergentProperties();
        
        return this.integrateResults(results, totalInfluence);
    }
    
    // エネルギーレベルに応じて活性化するレベルを調整
    adjustActiveLevels(energy) {
        // エネルギーが少ない場合は高次の思考を無効化
        this.levels.metacognition.active = energy > 0.7;
        this.levels.abstractThinking.active = energy > 0.6;
        this.levels.socialThinking.active = energy > 0.5;
        this.levels.strategicThinking.active = energy > 0.4;
        this.levels.tacticalThinking.active = energy > 0.3;
        // 基本的な機能は常に活性化
        this.levels.learnedBehaviors.active = energy > 0.2;
        this.levels.instincts.active = energy > 0.1;
        this.levels.reflexes.active = true; // 反射は常に活性化
    }
    
    // 各思考レベルの処理メソッド
    processReflexes(lifeform, environment) {
        // 即時的な反応を処理
        // 例: 危険からの回避、光への反応など
        return { influence: 0.5, action: 'avoid_danger' };
    }
    
    processInstincts(lifeform, environment) {
        // 本能的な行動を処理
        // 例: 食料探索、繁殖行動など
        return { influence: 0.6, action: 'seek_food' };
    }
    
    // 他のレベルの処理メソッドも同様に実装...
    
    // 創発的特性の更新
    updateEmergentProperties() {
        // 思考履歴から創発的特性を計算
        
        // 創造性: 新しい行動パターンの発見
        this.emergentProperties.creativity = this.calculateCreativity();
        
        // 適応性: 環境変化への対応能力
        this.emergentProperties.adaptability = this.calculateAdaptability();
        
        // 意識: 自己認識と環境認識の度合い
        this.emergentProperties.consciousness = this.calculateConsciousness();
    }
    
    // 各創発的特性の計算メソッド
    calculateCreativity() {
        // 思考履歴から新しい行動パターンの多様性を計算
        // 実装例: 行動の多様性指数を計算
        return 0.5; // 仮の値
    }
    
    calculateAdaptability() {
        // 環境変化に対する適応度を計算
        return 0.5; // 仮の値
    }
    
    calculateConsciousness() {
        // 自己認識と環境認識の度合いを計算
        // メタ認知の活性度と相関
        return this.levels.metacognition.active ? 0.8 : 0.2;
    }
    
    // 各レベルの結果を統合
    integrateResults(results, totalInfluence) {
        // 各レベルの結果を統合して最終的な行動決定を行う
        const finalDecision = {
            action: null,
            confidence: 0
        };
        
        // 影響度の高い行動を選択
        for (const [level, result] of Object.entries(results)) {
            const weight = result.influence * this.levels[level].priority / totalInfluence;
            if (weight > finalDecision.confidence) {
                finalDecision.action = result.action;
                finalDecision.confidence = weight;
            }
        }
        
        return finalDecision;
    }
} 

class DNARepairSystem {
    constructor(lifeform) {
        this.lifeform = lifeform;
        this.errorDetectionRate = lifeform.dna.errorDetection || 0.6; // エラー検出能力
        this.repairEfficiency = lifeform.dna.repairEfficiency || 0.7; // 修復効率
        this.energyCost = 0.01; // 修復のエネルギーコスト
        this.errorLog = []; // 検出されたエラーのログ
        this.repairHistory = []; // 修復履歴
        this.checksumTable = new Map(); // 遺伝子のチェックサム
        
        // 初期チェックサムの計算
        this.calculateChecksums();
    }
    
    // 遺伝子のチェックサムを計算
    calculateChecksums() {
        for (const [gene, value] of Object.entries(this.lifeform.dna)) {
            if (typeof value === 'number') {
                // 単純な数値のチェックサム
                this.checksumTable.set(gene, this.calculateChecksum(value));
            } else if (typeof value === 'object' && value !== null) {
                // ネストされたオブジェクトの場合は再帰的に処理
                this.calculateNestedChecksums(gene, value);
            }
        }
    }
    
    // ネストされたオブジェクトのチェックサムを計算
    calculateNestedChecksums(prefix, obj) {
        for (const [key, value] of Object.entries(obj)) {
            const fullKey = `${prefix}.${key}`;
            if (typeof value === 'number') {
                this.checksumTable.set(fullKey, this.calculateChecksum(value));
            } else if (typeof value === 'object' && value !== null) {
                this.calculateNestedChecksums(fullKey, value);
            }
        }
    }
    
    // 単純なチェックサム計算（例：値を10倍して小数点以下を切り捨て、各桁の和を計算）
    calculateChecksum(value) {
        const scaled = Math.floor(value * 10);
        let sum = 0;
        let num = scaled;
        while (num > 0) {
            sum += num % 10;
            num = Math.floor(num / 10);
        }
        return sum;
    }
    
    // DNAのエラーを検出
    detectErrors() {
        const detectedErrors = [];
        
        // チェックサムを使ってエラーを検出
        for (const [gene, originalChecksum] of this.checksumTable.entries()) {
            // 遺伝子パスを解析
            const genePath = gene.split('.');
            let target = this.lifeform.dna;
            let valid = true;
            
            for (let i = 0; i < genePath.length - 1; i++) {
                if (target[genePath[i]]) {
                    target = target[genePath[i]];
                } else {
                    valid = false;
                    break;
                }
            }
            
            const finalGene = genePath[genePath.length - 1];
            if (valid && target[finalGene] !== undefined) {
                const currentValue = target[finalGene];
                const currentChecksum = this.calculateChecksum(currentValue);
                
                // チェックサムが一致しない場合はエラー
                if (currentChecksum !== originalChecksum) {
                    // エラー検出率に基づいて検出
                    if (Math.random() < this.errorDetectionRate) {
                        detectedErrors.push({
                            gene: gene,
                            originalChecksum: originalChecksum,
                            currentChecksum: currentChecksum,
                            currentValue: currentValue
                        });
                    }
                }
            }
        }
        
        this.errorLog = [...this.errorLog, ...detectedErrors];
        return detectedErrors;
    }
    
    // 検出されたエラーを修復
    repairErrors() {
        if (this.errorLog.length === 0) return 0;
        
        let repairedCount = 0;
        const remainingErrors = [];
        
        for (const error of this.errorLog) {
            // 修復効率に基づいて修復を試みる
            if (Math.random() < this.repairEfficiency) {
                // 遺伝子パスを解析
                const genePath = error.gene.split('.');
                let target = this.lifeform.dna;
                let valid = true;
                
                for (let i = 0; i < genePath.length - 1; i++) {
                    if (target[genePath[i]]) {
                        target = target[genePath[i]];
                    } else {
                        valid = false;
                        break;
                    }
                }
                
                const finalGene = genePath[genePath.length - 1];
                if (valid && target[finalGene] !== undefined) {
                    // 値を調整して正しいチェックサムに近づける
                    let bestValue = target[finalGene];
                    let bestDiff = Math.abs(this.calculateChecksum(bestValue) - error.originalChecksum);
                    
                    // 値を少しずつ変えてチェックサムが合う値を探す
                    for (let i = 0; i < 20; i++) {
                        const testValue = target[finalGene] * (1 + (Math.random() - 0.5) * 0.1);
                        const testChecksum = this.calculateChecksum(testValue);
                        const diff = Math.abs(testChecksum - error.originalChecksum);
                        
                        if (diff < bestDiff) {
                            bestValue = testValue;
                            bestDiff = diff;
                            
                            // 完全に一致したら終了
                            if (diff === 0) break;
                        }
                    }
                    
                    // 修復を適用
                    target[finalGene] = bestValue;
                    
                    // 修復履歴に追加
                    this.repairHistory.push({
                        time: Date.now(),
                        gene: error.gene,
                        from: error.currentValue,
                        to: bestValue
                    });
                    
                    repairedCount++;
                    
                    // エネルギーコストを適用
                    this.lifeform.energy -= this.energyCost;
                } else {
                    remainingErrors.push(error);
                }
            } else {
                remainingErrors.push(error);
            }
        }
        
        // 修復できなかったエラーを保持
        this.errorLog = remainingErrors;
        
        return repairedCount;
    }
    
    // 定期的なDNA整合性チェックと修復
    update() {
        // エラー検出
        const errors = this.detectErrors();
        
        // エラーがあれば修復を試みる
        if (errors.length > 0) {
            const repairedCount = this.repairErrors();
            
            // 修復後にチェックサムを更新
            if (repairedCount > 0) {
                this.calculateChecksums();
            }
            
            return {
                detected: errors.length,
                repaired: repairedCount
            };
        }
        
        return {
            detected: 0,
            repaired: 0
        };
    }
}

class CommunicationSystem {
    constructor(lifeform) {
        this.lifeform = lifeform;
        this.messageQueue = []; // 送信待ちメッセージ
        this.receivedMessages = []; // 受信したメッセージ
        this.knownPeers = new Map(); // 通信相手の記録
        this.communicationRange = 5 + lifeform.dna.perception * 5; // 通信範囲
        this.bandwidth = lifeform.dna.communicationBandwidth || 0.5; // 通信帯域幅
        this.reliability = lifeform.dna.communicationReliability || 0.7; // 通信信頼性
        this.energyCostPerMessage = 0.005; // メッセージ送信のエネルギーコスト
        
        // メッセージタイプ
        this.MESSAGE_TYPES = {
            RESOURCE_LOCATION: 'resource_location',
            THREAT_WARNING: 'threat_warning',
            MATING_REQUEST: 'mating_request',
            COOPERATION_OFFER: 'cooperation_offer',
            TERRITORY_CLAIM: 'territory_claim',
            KNOWLEDGE_SHARE: 'knowledge_share'
        };
    }
    
    // メッセージを送信キューに追加
    queueMessage(type, data, targetId = null) {
        // エネルギーが足りない場合は送信しない
        if (this.lifeform.energy < this.energyCostPerMessage) return false;
        
        const message = {
            id: Math.random().toString(36).substr(2, 9), // ユニークID
            type: type,
            data: data,
            senderId: this.lifeform.id,
            targetId: targetId, // null の場合はブロードキャスト
            timestamp: Date.now(),
            ttl: 3 // Time To Live
        };
        
        this.messageQueue.push(message);
        return true;
    }
    
    // メッセージを送信（実際の通信処理）
    transmitMessages(lifeforms) {
        if (this.messageQueue.length === 0) return;
        
        const messagesToSend = this.messageQueue.splice(0, Math.ceil(this.bandwidth * 5)); // 帯域幅に基づいて送信数を制限
        
        for (const message of messagesToSend) {
            // エネルギーコストを適用
            this.lifeform.energy -= this.energyCostPerMessage;
            
            // 通信範囲内の生命体にメッセージを送信
            for (const other of lifeforms) {
                if (other === this.lifeform || other.isDead) continue;
                
                // ターゲットが指定されている場合は、そのターゲットにのみ送信
                if (message.targetId && message.targetId !== other.id) continue;
                
                const distance = this.lifeform.getDistanceTo(other);
                
                if (distance <= this.communicationRange) {
                    // 距離に基づいて信頼性を調整
                    const distanceReliability = 1 - (distance / this.communicationRange);
                    const effectiveReliability = this.reliability * distanceReliability;
                    
                    // 信頼性に基づいて送信成功を判定
                    if (Math.random() < effectiveReliability) {
                        // メッセージを相手の受信キューに追加
                        other.communicationSystem.receiveMessage({
                            ...message,
                            ttl: message.ttl - 1
                        });
                        
                        // 通信相手を記録
                        this.knownPeers.set(other.id, {
                            lastContact: Date.now(),
                            reliability: (this.knownPeers.get(other.id)?.reliability || 0) * 0.9 + 0.1 * effectiveReliability
                        });
                    }
                }
            }
        }
    }
    
    // メッセージを受信
    receiveMessage(message) {
        // TTLが0以下のメッセージは破棄
        if (message.ttl <= 0) return;
        
        // 送信者を記録
        if (message.senderId !== this.lifeform.id) {
            this.knownPeers.set(message.senderId, {
                lastContact: Date.now(),
                reliability: (this.knownPeers.get(message.senderId)?.reliability || 0.5)
            });
        }
        
        // 受信メッセージを処理
        this.receivedMessages.push(message);
        
        // 受信キューが大きすぎる場合は古いメッセージを削除
        if (this.receivedMessages.length > 20) {
            this.receivedMessages.shift();
        }
    }
    
    // 受信したメッセージを処理
    processMessages() {
        if (this.receivedMessages.length === 0) return;
        
        const processedMessages = [];
        
        for (const message of this.receivedMessages) {
            switch (message.type) {
                case this.MESSAGE_TYPES.RESOURCE_LOCATION:
                    this.processResourceLocationMessage(message);
                    break;
                case this.MESSAGE_TYPES.THREAT_WARNING:
                    this.processThreatWarningMessage(message);
                    break;
                case this.MESSAGE_TYPES.MATING_REQUEST:
                    this.processMatingRequestMessage(message);
                    break;
                case this.MESSAGE_TYPES.COOPERATION_OFFER:
                    this.processCooperationOfferMessage(message);
                    break;
                case this.MESSAGE_TYPES.TERRITORY_CLAIM:
                    this.processTerritoryClaimMessage(message);
                    break;
                case this.MESSAGE_TYPES.KNOWLEDGE_SHARE:
                    this.processKnowledgeShareMessage(message);
                    break;
            }
            
            processedMessages.push(message);
        }
        
        // 処理済みメッセージを削除
        this.receivedMessages = this.receivedMessages.filter(msg => !processedMessages.includes(msg));
    }
    
    // リソース位置メッセージの処理
    processResourceLocationMessage(message) {
        // リソース位置情報を記憶
        if (!this.lifeform.memory) this.lifeform.memory = {};
        if (!this.lifeform.memory.resourceLocations) this.lifeform.memory.resourceLocations = [];
        
        // 既存の情報を更新または新規追加
        const existingIndex = this.lifeform.memory.resourceLocations.findIndex(
            loc => loc.x === message.data.x && loc.y === message.data.y
        );
        
        if (existingIndex >= 0) {
            this.lifeform.memory.resourceLocations[existingIndex] = {
                ...message.data,
                timestamp: Date.now(),
                reliability: this.knownPeers.get(message.senderId)?.reliability || 0.5
            };
        } else {
            this.lifeform.memory.resourceLocations.push({
                ...message.data,
                timestamp: Date.now(),
                reliability: this.knownPeers.get(message.senderId)?.reliability || 0.5
            });
        }
        
        // 古い情報を削除
        const MAX_AGE = 1000 * 60; // 1分
        this.lifeform.memory.resourceLocations = this.lifeform.memory.resourceLocations.filter(
            loc => Date.now() - loc.timestamp < MAX_AGE
        );
    }
    
    // 脅威警告メッセージの処理
    processThreatWarningMessage(message) {
        // 脅威情報を記憶
        if (!this.lifeform.memory) this.lifeform.memory = {};
        if (!this.lifeform.memory.threats) this.lifeform.memory.threats = [];
        
        this.lifeform.memory.threats.push({
            ...message.data,
            timestamp: Date.now(),
            reliability: this.knownPeers.get(message.senderId)?.reliability || 0.5
        });
        
        // 古い情報を削除
        const MAX_AGE = 1000 * 30; // 30秒
        this.lifeform.memory.threats = this.lifeform.memory.threats.filter(
            threat => Date.now() - threat.timestamp < MAX_AGE
        );
        
        // 脅威に対する即時反応（一時的な行動修正）
        if (this.knownPeers.get(message.senderId)?.reliability > 0.7) {
            // 信頼性の高い送信者からの警告は即座に反応
            const threatDirection = {
                x: message.data.x - this.lifeform.position.x,
                y: message.data.y - this.lifeform.position.y,
                z: message.data.z - this.lifeform.position.z
            };
            
            // 脅威から逃げる方向に一時的な加速を適用
            const magnitude = 0.1;
            this.lifeform.acceleration.x -= threatDirection.x * magnitude;
            this.lifeform.acceleration.y -= threatDirection.y * magnitude;
            this.lifeform.acceleration.z -= threatDirection.z * magnitude;
        }
    }
    
    // その他のメッセージ処理メソッド...
    
    // 知識共有メッセージの処理
    processKnowledgeShareMessage(message) {
        // 共有された知識を学習
        if (message.data.behaviorWeights) {
            // 行動重みの学習
            for (const [behavior, weight] of Object.entries(message.data.behaviorWeights)) {
                if (this.lifeform.behaviorWeights && this.lifeform.behaviorWeights[behavior] !== undefined) {
                    // 既存の重みと共有された重みを混合
                    const reliability = this.knownPeers.get(message.senderId)?.reliability || 0.5;
                    this.lifeform.behaviorWeights[behavior] = 
                        this.lifeform.behaviorWeights[behavior] * (1 - reliability * 0.2) + 
                        weight * reliability * 0.2;
                }
            }
        }
        
        // 環境知識の共有
        if (message.data.environmentalKnowledge) {
            if (!this.lifeform.memory) this.lifeform.memory = {};
            if (!this.lifeform.memory.environmentalKnowledge) this.lifeform.memory.environmentalKnowledge = {};
            
            // 環境知識を更新
            for (const [key, value] of Object.entries(message.data.environmentalKnowledge)) {
                if (!this.lifeform.memory.environmentalKnowledge[key]) {
                    this.lifeform.memory.environmentalKnowledge[key] = value;
                } else {
                    // 既存の知識と新しい知識を混合
                    const reliability = this.knownPeers.get(message.senderId)?.reliability || 0.5;
                    this.lifeform.memory.environmentalKnowledge[key] = 
                        this.lifeform.memory.environmentalKnowledge[key] * (1 - reliability * 0.3) + 
                        value * reliability * 0.3;
                }
            }
        }
    }
    
    // 定期的な情報共有
    shareKnowledge(lifeforms) {
        // エネルギーが少ない場合は共有しない
        if (this.lifeform.energy < 0.3) return;
        
        // 共有する知識を準備
        const knowledgeToShare = {
            behaviorWeights: this.lifeform.behaviorWeights,
            environmentalKnowledge: this.lifeform.memory?.environmentalKnowledge || {}
        };
        
        // 近くの生命体に知識を共有
        this.queueMessage(
            this.MESSAGE_TYPES.KNOWLEDGE_SHARE,
            knowledgeToShare
        );
    }
    
    // 通信システムの更新
    update(lifeforms) {
        // メッセージの送信
        this.transmitMessages(lifeforms);
        
        // メッセージの処理
        this.processMessages();
        
        // 定期的な情報共有（低確率で実行）
        if (Math.random() < 0.02) {
            this.shareKnowledge(lifeforms);
        }
        
        // リソース発見時の共有
        if (this.lifeform.lastFoundResource && Date.now() - this.lifeform.lastFoundResource.time < 1000) {
            this.queueMessage(
                this.MESSAGE_TYPES.RESOURCE_LOCATION,
                {
                    type: this.lifeform.lastFoundResource.type,
                    x: this.lifeform.lastFoundResource.x,
                    y: this.lifeform.lastFoundResource.y,
                    z: this.lifeform.lastFoundResource.z,
                    amount: this.lifeform.lastFoundResource.amount
                }
            );
        }
        
        // 脅威検出時の警告
        const threats = this.lifeform.detectThreats(lifeforms);
        if (threats.length > 0) {
            for (const threat of threats) {
                this.queueMessage(
                    this.MESSAGE_TYPES.THREAT_WARNING,
                    {
                        x: threat.lifeform.position.x,
                        y: threat.lifeform.position.y,
                        z: threat.lifeform.position.z,
                        type: threat.lifeform.isPredator ? 'predator' : 'competitor',
                        severity: threat.lifeform.energy
                    }
                );
            }
        }
    }
}

class MetaprogrammingSystem {
    constructor(lifeform) {
        this.lifeform = lifeform;
        this.algorithms = {
            resourceGathering: this.createDefaultResourceGatheringAlgorithm(),
            predatorAvoidance: this.createDefaultPredatorAvoidanceAlgorithm(),
            mating: this.createDefaultMatingAlgorithm(),
            exploration: this.createDefaultExplorationAlgorithm()
        };
        
        this.performanceMetrics = {
            resourceGathering: { success: 0, attempts: 0 },
            predatorAvoidance: { success: 0, attempts: 0 },
            mating: { success: 0, attempts: 0 },
            exploration: { success: 0, attempts: 0 }
        };
        
        this.optimizationHistory = [];
        this.currentOptimizationTarget = null;
        this.optimizationCooldown = 0;
        
        // メタプログラミング能力
        this.metaprogrammingAbility = lifeform.dna.metaprogrammingAbility || 0.3;
        this.learningRate = lifeform.dna.learningRate || 0.2;
        this.creativityFactor = lifeform.dna.creativity || 0.4;
    }
    
    // デフォルトのリソース収集アルゴリズム
    createDefaultResourceGatheringAlgorithm() {
        return {
            name: "基本リソース収集",
            parameters: {
                searchRadius: 10,
                priorityThreshold: 0.5,
                energyThreshold: 0.3,
                explorationWeight: 0.5
            },
            code: function(lifeform, environment, parameters) {
                // 基本的なリソース収集ロジック
                const resources = lifeform.detectResources(environment);
                if (resources.length === 0) {
                    // リソースが見つからない場合は探索
                    return {
                        action: "explore",
                        direction: {
                            x: (Math.random() - 0.5) * parameters.explorationWeight,
                            y: (Math.random() - 0.5) * parameters.explorationWeight,
                            z: (Math.random() - 0.5) * parameters.explorationWeight * 0.5
                        }
                    };
                }
                
                // 最も価値の高いリソースを選択
                let bestResource = resources[0];
                let bestValue = bestResource.amount / (bestResource.distance || 1);
                
                for (let i = 1; i < resources.length; i++) {
                    const resource = resources[i];
                    const value = resource.amount / (resource.distance || 1);
                    if (value > bestValue) {
                        bestValue = value;
                        bestResource = resource;
                    }
                }
                
                // リソースに向かう
                const dx = bestResource.position.x - lifeform.position.x;
                const dy = bestResource.position.y - lifeform.position.y;
                const dz = bestResource.position.z - lifeform.position.z;
                
                return {
                    action: "move_to_resource",
                    direction: {
                        x: dx * 0.1,
                        y: dy * 0.1,
                        z: dz * 0.1
                    },
                    target: bestResource
                };
            }
        };
    }
    
    // デフォルトの捕食者回避アルゴリズム
    createDefaultPredatorAvoidanceAlgorithm() {
        return {
            name: "基本捕食者回避",
            parameters: {
                detectionRadius: 15,
                fleeMultiplier: 1.5,
                groupingWeight: 0.5,
                hidingWeight: 0.7
            },
            code: function(lifeform, environment, parameters, lifeforms) {
                // 捕食者検出
                const threats = lifeform.detectThreats(lifeforms || []);
                if (threats.length === 0) {
                    return { action: "no_threat" };
                }
                
                // 最も近い脅威を特定
                let closestThreat = threats[0];
                for (let i = 1; i < threats.length; i++) {
                    if (threats[i].distance < closestThreat.distance) {
                        closestThreat = threats[i];
                    }
                }
                
                // 脅威から逃げる方向を計算
                const dx = lifeform.position.x - closestThreat.lifeform.position.x;
                const dy = lifeform.position.y - closestThreat.lifeform.position.y;
                const dz = lifeform.position.z - closestThreat.lifeform.position.z;
                
                // 距離に基づいて逃げる強さを調整
                const distanceFactor = Math.max(0.1, Math.min(1.0, 1.0 / closestThreat.distance));
                
                return {
                    action: "flee",
                    direction: {
                        x: dx * distanceFactor * parameters.fleeMultiplier,
                        y: dy * distanceFactor * parameters.fleeMultiplier,
                        z: dz * distanceFactor * parameters.fleeMultiplier
                    },
                    threat: closestThreat
                };
            }
        };
    }
    
    // デフォルトの交配アルゴリズム
    createDefaultMatingAlgorithm() {
        return {
            name: "基本交配戦略",
            parameters: {
                searchRadius: 12,
                energyThreshold: 0.7,
                compatibilityThreshold: 0.6,
                approachSpeed: 0.5
            },
            code: function(lifeform, environment, parameters, lifeforms) {
                // エネルギーが閾値未満なら交配しない
                if (lifeform.energy < parameters.energyThreshold) {
                    return { action: "conserve_energy" };
                }
                
                // 互換性のある仲間を探す
                const companions = lifeform.findCompatibleCompanions(lifeforms || []);
                if (companions.length === 0) {
                    return { action: "search_mate" };
                }
                
                // 最も互換性の高い相手を選択
                let bestMate = null;
                let bestCompatibility = parameters.compatibilityThreshold;
                
                for (const companion of companions) {
                    // 遺伝的距離に基づく互換性を計算
                    const geneticDistance = lifeform.calculateGeneticDistance(companion.lifeform);
                    const compatibility = 1.0 - geneticDistance;
                    
                    if (compatibility > bestCompatibility && companion.lifeform.energy > parameters.energyThreshold) {
                        bestMate = companion;
                        bestCompatibility = compatibility;
                    }
                }
                
                if (!bestMate) {
                    return { action: "search_mate" };
                }
                
                // 選択した相手に近づく
                const dx = bestMate.lifeform.position.x - lifeform.position.x;
                const dy = bestMate.lifeform.position.y - lifeform.position.y;
                const dz = bestMate.lifeform.position.z - lifeform.position.z;
                
                // 十分近ければ交配を試みる
                if (bestMate.distance < 2.0) {
                    return {
                        action: "attempt_mating",
                        target: bestMate.lifeform
                    };
                }
                
                return {
                    action: "approach_mate",
                    direction: {
                        x: dx * parameters.approachSpeed,
                        y: dy * parameters.approachSpeed,
                        z: dz * parameters.approachSpeed
                    },
                    target: bestMate.lifeform
                };
            }
        };
    }
    
    // デフォルトの探索アルゴリズム
    createDefaultExplorationAlgorithm() {
        return {
            name: "基本探索戦略",
            parameters: {
                explorationRadius: 20,
                changeDirectionProbability: 0.05,
                depthExplorationWeight: 0.3,
                curiosityFactor: 0.5
            },
            code: function(lifeform, environment, parameters) {
                // 方向転換の判定
                if (!lifeform._explorationDirection || Math.random() < parameters.changeDirectionProbability) {
                    // 新しい探索方向を設定
                    const angle = Math.random() * Math.PI * 2;
                    const verticalAngle = (Math.random() - 0.5) * Math.PI * parameters.depthExplorationWeight;
                    
                    lifeform._explorationDirection = {
                        x: Math.cos(angle) * parameters.curiosityFactor,
                        y: Math.sin(angle) * parameters.curiosityFactor,
                        z: Math.sin(verticalAngle) * parameters.curiosityFactor * 0.5
                    };
                    
                    lifeform._explorationDuration = Math.floor(Math.random() * 50) + 10;
                } else {
                    // 探索継続時間を減少
                    lifeform._explorationDuration--;
                    if (lifeform._explorationDuration <= 0) {
                        lifeform._explorationDirection = null;
                    }
                }
                
                // 環境の境界に近づいたら方向を調整
                const margin = 5;
                if (lifeform.position.x < margin || lifeform.position.x > width - margin ||
                    lifeform.position.y < margin || lifeform.position.y > height - margin ||
                    lifeform.position.z < -10 + margin || lifeform.position.z > 10 - margin) {
                    
                    // 中心方向に向かう成分を追加
                    const centerX = width / 2;
                    const centerY = height / 2;
                    const centerZ = 0;
                    
                    const toCenterX = centerX - lifeform.position.x;
                    const toCenterY = centerY - lifeform.position.y;
                    const toCenterZ = centerZ - lifeform.position.z;
                    
                    const centeringFactor = 0.2;
                    
                    if (lifeform._explorationDirection) {
                        lifeform._explorationDirection.x += toCenterX * centeringFactor;
                        lifeform._explorationDirection.y += toCenterY * centeringFactor;
                        lifeform._explorationDirection.z += toCenterZ * centeringFactor;
                    }
                }
                
                return {
                    action: "explore",
                    direction: lifeform._explorationDirection || {
                        x: (Math.random() - 0.5) * parameters.curiosityFactor,
                        y: (Math.random() - 0.5) * parameters.curiosityFactor,
                        z: (Math.random() - 0.5) * parameters.curiosityFactor * 0.5
                    }
                };
            }
        };
    }
    
    // アルゴリズムの実行
    executeAlgorithm(type, environment, lifeforms) {
        const algorithm = this.algorithms[type];
        if (!algorithm) return null;
        
        try {
            // アルゴリズムの実行を試みる
            this.performanceMetrics[type].attempts++;
            const result = algorithm.code(this.lifeform, environment, algorithm.parameters, lifeforms);
            return result;
        } catch (error) {
            // エラーが発生した場合は記録
            console.error(`Algorithm execution error (${type}):`, error);
            return null;
        }
    }
    
    // アルゴリズムの最適化
    optimizeAlgorithm(type) {
        const algorithm = this.algorithms[type];
        if (!algorithm) return false;
        
        // 最適化の成功率はメタプログラミング能力に依存
        const optimizationChance = this.metaprogrammingAbility * 0.5;
        if (Math.random() > optimizationChance) return false;
        
        // パフォーマンスメトリクスを取得
        const metrics = this.performanceMetrics[type];
        if (metrics.attempts < 10) return false; // 十分なデータがない
        
        const successRate = metrics.success / metrics.attempts;
        
        // パラメータの最適化
        const paramKeys = Object.keys(algorithm.parameters);
        if (paramKeys.length === 0) return false;
        
        // ランダムにパラメータを選択して調整
        const paramToOptimize = paramKeys[Math.floor(Math.random() * paramKeys.length)];
        const currentValue = algorithm.parameters[paramToOptimize];
        
        // 成功率に基づいて調整方向を決定
        const adjustmentDirection = successRate < 0.5 ? -1 : 1;
        
        // 創造性に基づいて調整量を決定
        const adjustmentAmount = this.creativityFactor * (Math.random() * 0.2 + 0.05);
        
        // パラメータを調整
        const newValue = currentValue * (1 + adjustmentDirection * adjustmentAmount);
        
        // 調整を記録
        this.optimizationHistory.push({
            time: Date.now(),
            algorithm: type,
            parameter: paramToOptimize,
            oldValue: currentValue,
            newValue: newValue,
            successRate: successRate
        });
        
        // パラメータを更新
        algorithm.parameters[paramToOptimize] = newValue;
        
        // メトリクスをリセット
        metrics.success = 0;
        metrics.attempts = 0;
        
        return true;
    }
    
    // 行動結果のフィードバック
    provideFeedback(type, success) {
        if (!this.performanceMetrics[type]) return;
        
        if (success) {
            this.performanceMetrics[type].success++;
        }
    }
    
    // 新しいアルゴリズムの生成（創造的プロセス）
    createNewAlgorithm(baseType) {
        // 創造性が低い場合は失敗
        if (Math.random() > this.creativityFactor) return null;
        
        const baseAlgorithm = this.algorithms[baseType];
        if (!baseAlgorithm) return null;
        
        // 新しいアルゴリズム名
        const newName = `進化型${baseAlgorithm.name}`;
        
        // パラメータの変異
        const newParameters = {};
        for (const [key, value] of Object.entries(baseAlgorithm.parameters)) {
            // 各パラメータをランダムに変異
            newParameters[key] = value * (1 + (Math.random() - 0.5) * this.creativityFactor);
        }
        
        // 新しいパラメータの追加（低確率）
        if (Math.random() < this.creativityFactor * 0.3) {
            const newParamName = `adaptive_${Math.floor(Math.random() * 1000)}`;
            newParameters[newParamName] = Math.random();
        }
        
        // コードの変異（実際には難しいので、ここではパラメータ参照方法を変更）
        const newCode = function(lifeform, environment, parameters, lifeforms) {
            // 基本的には元のコードを実行
            const result = baseAlgorithm.code(lifeform, environment, parameters, lifeforms);
            
            // 結果に適応的な修正を加える
            if (result && result.direction) {
                // 環境状態に基づく適応
                const environmentalFactor = environment?.systemState?.cpuLoad || 0.5;
                
                // 方向の微調整
                result.direction.x *= 1 + (environmentalFactor - 0.5) * 0.2;
                result.direction.y *= 1 + (environmentalFactor - 0.5) * 0.2;
                
                // エネルギー状態に基づく調整
                if (lifeform.energy < 0.3) {
                    // 省エネモード
                    result.direction.x *= 0.8;
                    result.direction.y *= 0.8;
                    result.direction.z *= 0.8;
                }
            }
            
            return result;
        };
        
        // 新しいアルゴリズムを返す
        return {
            name: newName,
            parameters: newParameters,
            code: newCode,
            parent: baseType,
            creationTime: Date.now()
        };
    }
    
    // システム全体の更新
    update(environment, lifeforms) {
        // 最適化クールダウンの更新
        if (this.optimizationCooldown > 0) {
            this.optimizationCooldown--;
        }
        
        // 定期的な最適化（低確率）
        if (this.optimizationCooldown === 0 && Math.random() < 0.05) {
            // 最適化するアルゴリズムをランダムに選択
            const algorithmTypes = Object.keys(this.algorithms);
            const typeToOptimize = algorithmTypes[Math.floor(Math.random() * algorithmTypes.length)];
            
            // 最適化を試みる
            const optimized = this.optimizeAlgorithm(typeToOptimize);
            
            if (optimized) {
                // 最適化に成功したらクールダウンを設定
                this.optimizationCooldown = 50;
                this.currentOptimizationTarget = typeToOptimize;
            }
        }
        
        // 新しいアルゴリズムの創造（非常に低確率）
        if (Math.random() < 0.01 * this.creativityFactor) {
            const algorithmTypes = Object.keys(this.algorithms);
            const baseType = algorithmTypes[Math.floor(Math.random() * algorithmTypes.length)];
            
            const newAlgorithm = this.createNewAlgorithm(baseType);
            if (newAlgorithm) {
                // 新しいアルゴリズムを採用するかどうか決定
                const adoptionChance = this.metaprogrammingAbility * 0.3;
                if (Math.random() < adoptionChance) {
                    // 新しいアルゴリズムを採用
                    this.algorithms[baseType] = newAlgorithm;
                    
                    // メトリクスをリセット
                    this.performanceMetrics[baseType].success = 0;
                    this.performanceMetrics[baseType].attempts = 0;
                }
            }
        }
        
        // 状況に応じたアルゴリズム選択
        let selectedAction = null;
        
        // 脅威検出
        const threats = this.lifeform.detectThreats(lifeforms);
        if (threats.length > 0) {
            // 捕食者回避を優先
            selectedAction = this.executeAlgorithm('predatorAvoidance', environment, lifeforms);
            if (selectedAction && selectedAction.action !== 'no_threat') {
                return selectedAction;
            }
        }
        
        // エネルギー状態に基づく行動選択
        if (this.lifeform.energy < 0.3) {
            // エネルギーが低い場合はリソース収集を優先
            selectedAction = this.executeAlgorithm('resourceGathering', environment, lifeforms);
            if (selectedAction && selectedAction.action === 'move_to_resource') {
                return selectedAction;
            }
        } else if (this.lifeform.energy > 0.7) {
            // エネルギーが十分ある場合は交配を検討
            selectedAction = this.executeAlgorithm('mating', environment, lifeforms);
            if (selectedAction && (selectedAction.action === 'approach_mate' || selectedAction.action === 'attempt_mating')) {
                return selectedAction;
            }
        }
        
        // デフォルトは探索
        return this.executeAlgorithm('exploration', environment, lifeforms);
    }
    
    // アルゴリズムの性能分析
    analyzePerformance() {
        const analysis = {};
        
        for (const [type, metrics] of Object.entries(this.performanceMetrics)) {
            if (metrics.attempts === 0) {
                analysis[type] = { successRate: 0, confidence: 0 };
            } else {
                const successRate = metrics.success / metrics.attempts;
                const confidence = Math.min(1.0, metrics.attempts / 20); // サンプル数に基づく信頼度
                
                analysis[type] = { successRate, confidence };
            }
        }
        
        return analysis;
    }
} 

