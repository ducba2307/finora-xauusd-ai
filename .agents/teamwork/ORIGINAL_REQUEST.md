# Original User Request

## Initial Request — 2026-10-11T03:39:40Z

Nâng cấp, tối ưu hóa độ chính xác định lượng và hoàn thiện engine giao dịch cùng hệ thống kiểm thử toàn diện cho nền tảng Finora Quant AI Trading Platform (Forex, Gold, Crypto) đạt tiêu chuẩn cấp độ tổ chức và phần mềm SaaS chuyên nghiệp.

Working directory: d:\VIBECODE\finora-trading-ai
Integrity mode: development

## Requirements

### R1. Quantitative Trading Engine & Market Data Fidelity
Nâng cấp và chuẩn hóa luồng dữ liệu thị trường (Forex, Gold XAU/USD, Crypto BTC/ETH/SOL) với mô hình biến động giá chân thực, spread và trượt giá (slippage) sát với điều kiện thực tế của sàn giao dịch; đảm bảo cơ chế cập nhật không gây lag hoặc giật khung hình giao diện.

### R2. Backtest Engine & AI Alpha Precision
Kiểm định và chuẩn hóa toàn bộ công thức toán học trong bộ máy kiểm thử chiến lược (Backtest) và chỉ báo AI: tính toán chính xác Sharpe Ratio, Sortino Ratio, Calmar Ratio, Max Drawdown, Expectancy R-Multiple, loại bỏ hoàn toàn các lỗi Look-ahead bias, chia cho 0 hoặc giá trị NaN.

### R3. AI Trading Bots & Risk Management Safeguards
Hoàn thiện vòng đời lệnh của 4 Bot AI (Order lifecycle: Signal -> Validation -> Risk Check -> Execution -> Trailing -> Exit), tích hợp chốt chặn an toàn rủi ro cấp tài khoản (Daily Max Drawdown Circuit Breaker, Max Position Limit, Slippage Guard).

### R4. Production Reliability, Error Boundaries & SaaS Hardening
Triển khai Error Boundary toàn cục và cục bộ cho từng widget dữ liệu, tối ưu hóa vòng lặp render tránh memory leak khi streaming dữ liệu liên tục, chuẩn hóa các trạng thái kết nối mạng (Online/Reconnecting/Offline) và đảm bảo mã nguồn đạt tiêu chuẩn kiểm thử khắt khe.

## Acceptance Criteria

### Mathematical & Algorithmic Correctness
- [ ] Mọi chỉ số thống kê (Sharpe, Sortino, Win Rate, Max Drawdown, R-Distribution) trên Backtest Engine, AI Bots và Trading Journal đều cho kết quả hữu hạn, chính xác, không xuất hiện NaN hoặc Infinity trong bất kỳ kịch bản dữ liệu nào.
- [ ] Vòng đời lệnh giao dịch (tạo, cập nhật SL/TP, trailing stop, đóng vị thế) phản ánh đúng số dư vốn và PnL thực tế của tài khoản.

### Production Build & Stability
- [ ] Lệnh pnpm build (tsc -b && vite build) hoàn thành thành công với mã thoát 0, không có lỗi TypeScript hay cảnh báo đứt gãy phụ thuộc.
- [ ] Toàn bộ các phân hệ (Terminal, AI Quant Lab, Trading Journal, AI Market Intel, Trader Tools, Whale Radar) khởi chạy ổn định, không có unhandled promise rejections hay runtime error khi thao tác chuyển đổi qua lại.
- [ ] Cơ chế Circuit Breaker tự động khóa mở lệnh mới khi chạm ngưỡng rủi ro tối đa cho phép trong ngày.


## Follow-up — 2026-10-11T15:59:31Z

Milestone 1 and Milestone 2 are both verified DONE and PASSED with 191/191 tests passing and clean Vite build. Please spawn Project Orchestrator Generation 3 (orchestrator_3) to execute Milestone 3 (AI Trading Bots, 6-Stage Order Lifecycle & Account Risk Engine) and Milestone 4 as documented in orchestrator_2/handoff.md.
