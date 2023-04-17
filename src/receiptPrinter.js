import escpos from 'escpos';
import escpos_usb from 'escpos-usb';

escpos.USB = escpos_usb;
const device  = new escpos.USB();
 
const options = { encoding: "UTF8" }
 
const printer = new escpos.Printer(device, options);

function valePastel(printer) {
    return new Promise((resolve, reject) => {
        escpos.Image.load('img/pastel.png', (result) => {
            if(result instanceof Error) {
                console.log("error loading image: " + error);
                reject(error);
            }
            printer.image(result, 'd24');
            resolve();
        });
    });
}

device.open(async (error) => {
    if(error) {
        console.log("error opening device: " + error);
    } else {
        // await printer.font('a');
        await printer.align('ct')
        // await printer.style('NORMAL')
        // await printer.size(1, 1);
        await printer.lineSpace(1);
        await printer.text('Associacao de Pais e Professores EMEB Abelhinha Feliz\n');
        await printer.text('CNPJ 00.167.800/0001-00      \n');

        await printer.text('_____________________________\n');
        await printer.text('Pastel de Carne..........5,00\n');
        await printer.text('Pastel de Carne..........5,00\n');
        await printer.text('Refrigerante 300ML.......3,00\n');
        await printer.text('_____________________________\n');
        await printer.text('TOTAL                   13,00\n');

        // await printer.text(' --- CODIGO VERIFICADOR --- \n');
        // await printer.text('       6789 0123 4567\n\n');
        // await printer.text(' Utilize este codigo para confirmar que sua compra foi contabilizada no relatorio do evento. \n');
        // await printer.text(' Mais informacoes com a tesouraria da APP \n');

        // await printer.barcode('1234ABCD1234', 'CODE128');
        await valePastel(printer);
        
        await printer.cut();
        await printer.close();
    }
});

console.log("done!");