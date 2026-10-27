/** Culturally coherent parent names. A given name is only paired inside its own group. */

export type ParentCulture = 'uk' | 'irish' | 'south-asian' | 'arab' | 'african' | 'east-asian' | 'eastern-european'

export type ParentNameGroup = {
  culture: ParentCulture
  group: string
  women: string[]
  men: string[]
  surnames: string[]
  womenSurnames?: string[]
  menSurnames?: string[]
}

function list(value: string) {
  return value.split(',').map((part) => part.trim()).filter(Boolean)
}

export const PARENT_NAME_GROUPS: ParentNameGroup[] = [
  {
    culture: 'uk',
    group: 'english',
    women: list(`Hannah, Emily, Charlotte, Olivia, Sophie, Lucy, Grace, Rebecca, Laura, Sarah, Claire, Helen, Rachel, Katherine, Alison, Nicola, Victoria, Eleanor, Harriet, Abigail, Bethany, Jessica, Lauren, Amy, Natalie, Holly, Alice, Emma, Louise, Caroline, Gemma, Leanne, Samantha, Heather, Imogen, Felicity, Rosie, Florence, Matilda, Beatrice, Poppy, Maisie, Ruby, Evie, Dorothy, Edith, Irene, Sylvia, Audrey, Gillian, Philippa, Joanna, Kathryn, Deborah, Janet, Wendy, Julie, Tracey, Karen, Sharon, Michelle, Danielle, Stacey, Jodie, Kimberley, Dawn, Gail, Yvonne, Maureen, Pauline, Judith, Christine, Pamela, Rosemary, Beverley, Lorraine, Annette, Hilary, Brenda, Sandra, Donna, Cheryl, Lynda`),
    men: list(`James, Oliver, George, Harry, Jack, Thomas, William, Edward, Henry, Charles, Samuel, Joseph, Daniel, Matthew, Andrew, Christopher, David, Richard, Paul, Mark, Stephen, Robert, Michael, Peter, John, Simon, Martin, Colin, Keith, Graham, Nigel, Trevor, Alan, Brian, Kevin, Gary, Neil, Stuart, Benjamin, Nicholas, Jonathan, Timothy, Anthony, Dominic, Hugh, Ralph, Geoffrey, Roger, Philip, Dennis, Derek, Barry, Clive, Duncan, Eric, Frank, Gordon, Howard, Ian, Jeremy, Keith, Leonard, Malcolm, Norman, Oscar, Patrick, Quentin, Raymond, Sidney, Terence, Victor, Walter, Adrian, Bernard, Cecil, Donald, Ernest`),
    surnames: list(`Smith, Taylor, Brown, Wilson, Johnson, Roberts, Walker, Wright, Thompson, White, Hall, Green, Harris, Clarke, Robinson, Wood, Bennett, Cook, Cooper, Bailey, Parker, Morris, Edwards, Turner, King, Baker, Cox, Richardson, Foster, Russell, Butler, Barnes, Fisher, Webb, Simpson, Marshall, Reynolds, Harrison, Pearce, Dean, Hartley, Atkinson, Burton, Spencer, Walters, Sutton, Bishop, Nicholson, Chapman, Gregory, Holland, Fletcher, Briggs, Newton, Potter, Lowe, Bates, Hudson, Reeves, Parsons, Armstrong, Baldwin, Barrett, Benson, Booth, Bryant, Carpenter, Chandler, Curtis, Dawson, Dixon, Elliott, Ford, Gardner, Goodwin, Hardy, Hawkins, Horton, Jarvis, Kemp, Lambert, Lawrence, Miles, Moss, Nash, Osborne, Palmer, Pearson, Poole, Pratt, Shaw, Skinner, Steele, Summers, Terry, Watts, West, Yates, Young, Cross, Francis, Marsh, Howe, Slater, Frost, Hammond, Pope, Read, Carroll, Pearcey`),
  },
  {
    culture: 'uk',
    group: 'scottish',
    women: list(`Fiona, Morag, Isla, Eilidh, Catriona, Mhairi, Shona, Kirsty, Aileen, Lesley, Moira, Lorna, Iona, Mairi, Seonaid, Rhona, Elspeth, Flora, Morven, Ailsa, Kenna, Ina, Jeanette, Marsaili, Senga, Beathag, Eilidh, Fenella, Ishbel, Kirsteen, Murron, Peigi, Rona, Sorcha, Teasag`),
    men: list(`Hamish, Alistair, Callum, Douglas, Malcolm, Angus, Ewan, Murdo, Calum, Finlay, Gregor, Lachlan, Brodie, Keir, Magnus, Struan, Torquil, Ruaridh, Archie, Fergus, Alasdair, Arran, Blair, Carson, Drew, Euan, Farquhar, Gillies, Innes, Kirk, Lennox, Munro, Niven, Rab, Tavish`),
    surnames: list(`MacLeod, MacDonald, MacKenzie, MacKay, MacLean, MacIntyre, Stewart, Campbell, Fraser, Murray, Robertson, Gordon, Wallace, Buchanan, Cunningham, Drummond, Ferguson, Sutherland, Lindsay, Sinclair, Paterson, McGregor, Munro, Kerr, Ross, Duncan, Thomson, Brodie, Cameron, Douglas, Grant, Hunter, Scott, Reid, Burns, Crawford, Fleming, Hamilton, Johnston, Kennedy, Kerrigan, Lamont, McAllister, McCulloch, McFarlane, McIntosh, McMillan, McPherson, Napier, Ritchie`),
  },
  {
    culture: 'uk',
    group: 'welsh',
    women: list(`Cerys, Bethan, Lowri, Seren, Eleri, Anwen, Carys, Nia, Megan, Rhiannon, Ffion, Catrin, Gwen, Nesta, Mari, Delyth, Enid, Glenda, Myfanwy, Sian, Heulwen, Branwen, Tegan, Alys, Non, Gwenllian, Medi, Eira, Haf, Lowri, Manon, Nesta, Olwen, Rhonwen, Tesni`),
    men: list(`Rhys, Gareth, Dylan, Owen, Ioan, Geraint, Dafydd, Harri, Iestyn, Osian, Tomos, Aled, Bryn, Emrys, Gethin, Hywel, Idwal, Meurig, Rhodri, Steffan, Gwilym, Ifan, Carwyn, Dewi, Elis, Arwel, Bedwyr, Cadan, Deri, Eurig, Glyn, Huw, Ianto, Llew, Macsen, Ned, Owain, Prys, Rhun, Sion`),
    surnames: list(`Evans, Davies, Thomas, Williams, Jones, Hughes, Price, Griffiths, Powell, Rees, Pugh, Bowen, Howells, Lloyd, Vaughan, Pritchard, Richards, Jenkins, Lewis, Rowlands, Bevan, Hopkins, Matthews, Phillips, Morgan, Probert, Beynon, Cadwallader, Llewellyn, Meredith, Parry, Ellis, Tudor, Wynne, Yorath, Cadogan, Glyn, Huws, Islwyn, Mostyn`),
  },
  {
    culture: 'irish',
    group: 'irish',
    women: list(`Aoife, Niamh, Siobhan, Sinead, Orla, Grainne, Roisin, Nuala, Caoimhe, Aisling, Ciara, Clodagh, Deirdre, Eimear, Maeve, Mairead, Orlagh, Saoirse, Sorcha, Aine, Blathnaid, Dearbhla, Eabha, Fionnuala, Laoise, Meadhbh, Neasa, Oonagh, Riona, Treasa, Una, Ailbhe, Bronagh, Caitriona, Doireann, Emer, Fiadh, Muireann, Nessa, Aoibhinn, Cliodhna, Dervla, Eithne, Finola, Orna, Aifric, Breda, Attracta, Bernadette, Assumpta, Dolores, Eileen, Geraldine, Imelda, Kathleen, Philomena, Brigid, Sheila, Colette, Martina, Denise, Carmel, Concepta, Nollaig, Sadhbh, Sile, Peig, Gobnait, Ide, Blanaid, Caoilinn, Muire, Rois, Alannah, Bridget, Maura, Nora, Teresa, Concepta, Fidelma, Goretti, Majella, Attracta, Rosaleen, Sinead, Talulla, Eimear, Orlaith, Caoimhe, Niamh, Grainne, Roisin, Aisling, Ciara, Cliona, Dearbhail, Eavann, Fainche, Grainne, Lasairfhiona, Muirgheal, Nuala, Oonagh, Riona, Sorcha, Treasa, Una, Ailbhe, Brona`),
    men: list(`Sean, Conor, Cian, Oisin, Cillian, Padraig, Tadhg, Eoin, Darragh, Fionn, Lorcan, Niall, Ronan, Cathal, Diarmuid, Donncha, Eoghan, Fearghal, Gearoid, Liam, Odhran, Peadar, Ruairi, Senan, Ultan, Colm, Declan, Enda, Fergal, Kieran, Malachy, Seamus, Tiernan, Aidan, Brendan, Ciaran, Eamon, Finbar, Donal, Manus, Naoise, Proinsias, Rian, Shane, Tomas, Dermot, Fintan, Jarlath, Cormac, Daire, Eanna, Feidhlim, Kealan, Micheal, Odran, Piaras, Stiofan, Tiarnan, Art, Bran, Flann, Iarlaith, Uinseann, Cillian, Darragh, Eoin, Fionn, Lorcan, Niall, Ronan, Cathal, Diarmaid, Donnchadh, Eoghan, Fearghus, Gael, Iollan, Kevin, Lorcan, Muiris, Naos, Oisin, Padraig, Ruairi, Senan, Tadhg, Ultan, Colm, Declan, Enda, Fergal, Kieran, Malachy, Seamus, Tiernan, Aidan, Brendan, Ciaran, Eamon, Finbar, Donal, Barry, Gavin, Noel, Rory, Vincent, Colum, Pearse, Fergus, Manus, Naoise, Shane`),
    surnames: list(`Murphy, Kelly, Walsh, Byrne, Ryan, Doyle, Lynch, Power, Quinn, Moore, Daly, Dunne, Burke, Collins, Farrell, Fitzgerald, Flynn, Healy, Keane, Kelleher, Kenny, Maguire, Malone, Molloy, Mooney, Moran, Nolan, Regan, Reilly, Roche, Sheehan, Sheridan, Sweeney, Whelan, Crowley, Duffy, Foley, Hogan, Joyce, Kane, Lawlor, Maher, Phelan, Quigley, Redmond, Riordan, Scanlon, Tierney, Treacy, Ward, Brady, Buckley, Cahill, Clancy, Cleary, Connolly, Conway, Coughlan, Curran, Delaney, Doherty, Donnelly, Dowd, Dwyer, Egan, Fagan, Fallon, Feeney, Flanagan, Galvin, Gleeson, Griffin, Hennessy, Higgins, Keogh, Lavin, Lennon, Lydon, Madden, Meagher, Mullen, Nagle, Noonan, Purcell, Rafferty, Scully, Tobin, Tully, O'Brien, O'Connor, O'Sullivan, O'Neill, O'Reilly, O'Shea, O'Keefe, O'Malley, O'Connell, O'Rourke, O'Hara, O'Leary, O'Grady, O'Callaghan, O'Halloran, O'Gorman, O'Toole, O'Flaherty, O'Mahony, McCarthy, McMahon, McGrath, McLaughlin, McKenna, McDonagh, McCabe, McGovern, McNally, McDermott, McGuinness, McEvoy, McCormack, McNamara, McGee, McHugh, McLoughlin, McFadden, McGowan, McElroy, McInerney, McNulty, McKeown, McManus, McGinty, McCrory, McDaid, McElhinney, McGlinchey, McGurk, McIlroy, McKeever, McLarnon, McMullan, McNamee, McQuillan, McSorley, McVeigh, McWilliams`),
  },
  {
    culture: 'south-asian',
    group: 'hindu',
    women: list(`Ananya, Aditi, Anjali, Deepa, Divya, Isha, Kavita, Meera, Neha, Pooja, Priya, Riya, Sneha, Sunita, Asha, Geeta, Lakshmi, Nisha, Radha, Shreya, Bhavna, Chitra, Diya, Garima, Heena, Indira, Jyoti, Kalpana, Lalita, Madhuri, Namrata, Pallavi, Rekha, Savita, Tanvi, Uma, Vidya, Anika, Kritika, Mahima`),
    men: list(`Aarav, Arjun, Rohan, Vikram, Amit, Rajesh, Suresh, Anil, Vivek, Nikhil, Rahul, Sanjay, Ajay, Deepak, Manoj, Prakash, Rakesh, Sunil, Vijay, Ashok, Gaurav, Harsh, Karan, Mohit, Nitin, Pankaj, Ravi, Sachin, Tarun, Varun, Abhishek, Chetan, Dev, Girish, Hemant, Jatin, Kunal, Lokesh, Mayank, Naveen`),
    surnames: list(`Sharma, Verma, Gupta, Mishra, Joshi, Pandey, Tiwari, Shukla, Agarwal, Bansal, Saxena, Chauhan, Rathore, Thakur, Yadav, Kapoor, Malhotra, Khanna, Mehra, Bhatia, Sethi, Chopra, Khurana, Anand, Bajaj, Grover, Tandon, Sachdev, Oberoi, Dhawan, Arora, Bedi, Sodhi, Kohli, Ahluwalia, Talwar, Batra, Wadhwa, Chawla, Sood`),
  },
  {
    culture: 'south-asian',
    group: 'sikh',
    women: list(`Gurleen, Jasleen, Simran, Harleen, Prabhleen, Ishleen, Jasmeen, Navleen, Rajleen, Sukhleen, Avneet, Jaskiran, Kiranjot, Ramneek, Satleen, Manleen, Dilveer, Gursirat, Ekamjot, Harnoor`),
    men: list(`Harjit, Jagdeep, Rajinder, Sukhdev, Baldev, Kuldeep, Ranjit, Davinder, Harminder, Bhupinder, Fateh, Gurdeep, Joginder, Mohinder, Satnam, Tarlochan, Angad, Bikram, Gurbir, Hardit, Jaskaran, Onkar, Ranveer, Tegh, Udham, Zorawar, Ajit, Charanjit, Daljit, Inderpal`),
    surnames: list(`Gill, Dhillon, Sandhu, Grewal, Sidhu, Bajwa, Bains, Cheema, Mann, Deol, Bhatti, Chahal, Dosanjh, Johal, Maan, Pannu, Sahota, Thind, Virk, Atwal, Brar, Dhindsa, Khatkar, Rai, Aulakh, Bassi, Chatha, Dhaliwal, Ghuman, Hundal`),
  },
  {
    culture: 'south-asian',
    group: 'pakistani',
    women: list(`Ayesha, Fatima, Zainab, Maryam, Hira, Sana, Rabia, Khadija, Amina, Sadia, Nadia, Farah, Samina, Rubina, Shazia, Nazia, Uzma, Asma, Hina, Iqra, Laiba, Maham, Nimra, Sidra, Tahira, Bushra, Fariha, Humaira, Mehwish, Saima`),
    men: list(`Hassan, Hussain, Bilal, Imran, Usman, Faisal, Hamza, Junaid, Kamran, Nadeem, Tariq, Waqas, Yasir, Zafar, Adeel, Babar, Danish, Ehsan, Fahad, Irfan, Kashif, Luqman, Nasir, Qasim, Saad, Shahid, Talha, Umar, Zahid, Asif`),
    surnames: list(`Malik, Chaudhry, Butt, Mirza, Qureshi, Siddiqui, Abbasi, Hashmi, Rizvi, Naqvi, Jafri, Baig, Ansari, Khawaja, Raja, Awan, Minhas, Janjua, Lone, Wani, Akhtar, Paracha, Satti, Ghauri, Khokhar, Niazi, Tareen, Soomro, Junejo, Memon`),
  },
  {
    culture: 'south-asian',
    group: 'bangladeshi',
    women: list(`Nasreen, Farzana, Rumana, Taslima, Nabila, Sumaiya, Jannat, Sharmin, Laboni, Shaila, Tania, Urmi, Keya, Mitu, Poly, Rima, Orpa, Moury, Shapla, Lata`),
    men: list(`Jahangir, Mahmud, Rafiq, Shahin, Tanvir, Habib, Masud, Nazmul, Rakib, Sohel, Arman, Delwar, Farid, Helal, Jewel, Kamal, Liton, Monir, Nayeem, Rashed, Shafiq, Tuhin, Zakir, Anwar, Bashir, Golam, Iqbal, Pabel, Bappi, Habibur`),
    surnames: list(`Chowdhury, Hossain, Talukder, Sikder, Pramanik, Sarker, Miah, Bhuiyan, Mollah, Hawlader, Bepari, Kazi, Munshi, Akand, Howlader, Matubbar, Prodhan, Sardar, Gain, Khandaker`),
  },
  {
    culture: 'south-asian',
    group: 'bengali-hindu',
    women: list(`Debjani, Indrani, Madhumita, Nandita, Paromita, Suchitra, Tapasi, Kaberi, Nabanita, Oindrila, Piyali, Ranjana, Smita, Ujjaini, Jaya, Labanya, Mousumi, Trisha, Writtika, Rupa`),
    men: list(`Anirban, Bhaskar, Debashish, Gautam, Hirak, Indrajit, Joydeep, Kaushik, Mrinal, Partha, Rajib, Sabyasachi, Tamal, Udayan, Arindam, Chiranjit, Dipankar, Subrata, Prosenjit, Wriddhiman`),
    surnames: list(`Banerjee, Chatterjee, Mukherjee, Ghosh, Bose, Das, Dutta, Sen, Chakraborty, Ganguly, Basu, Mitra, Saha, Nandy, Guha, Lahiri, Majumdar, Bhattacharya, Pal, Roy`),
  },
  {
    culture: 'south-asian',
    group: 'sri-lankan',
    women: list(`Nimali, Sanduni, Dilini, Chamari, Thisuri, Achini, Hansika, Kasuni, Malsha, Pavithra`),
    men: list(`Nuwan, Kasun, Dinesh, Chaminda, Tharindu, Asela, Buddhika, Chathura, Lahiru, Mahela`),
    surnames: list(`Perera, Fernando, Silva, Jayawardena, Gunasekara, Wickramasinghe, Bandara, Ratnayake, Herath, Dissanayake, Alwis, Cooray, Peiris, Mendis, Senanayake, Abeysekera, Ekanayake, Weerasinghe, Pathirana, Jayasuriya`),
  },
  {
    culture: 'arab',
    group: 'levantine',
    women: list(`Layla, Rania, Hala, Dina, Lina, Maya, Nour, Rana, Sara, Yasmin, Dana, Farah, Reem, Salma, Hanan, Abeer, Ghada, Iman, Lama, Mirna`),
    men: list(`Karim, Samir, Bassam, Fadi, Hani, Jad, Khaled, Maher, Nabil, Rami, Sami, Tarek, Wael, Ziad, Adel, Bashar, Ghassan, Emile, Marwan, Walid`),
    surnames: list(`Haddad, Khoury, Nassar, Sabbagh, Aoun, Mansour, Darwish, Khatib, Najjar, Shammas, Tahan, Aswad, Boutros, Deeb, Fares, Ghanem, Hariri, Issa, Jaber, Karam, Maalouf, Najm, Qasem, Rahal, Tawil, Yazbek, Barakat, Daher, Nasr, Saleh, Shadid, Traboulsi, Younes, Zein, Atiyeh, Freiha, Lahham, Cortas, Geagea, Hobeika`),
  },
  {
    culture: 'arab',
    group: 'egyptian',
    women: list(`Amira, Dalia, Heba, Mona, Nadine, Ola, Passant, Yara, Basma, Lamia, Mervat, Noha, Jailan, Karima, Abeer, Dina, Hala, Layla, Nour, Rana`),
    men: list(`Mostafa, Youssef, Mahmoud, Tamer, Sherif, Hossam, Khalid, Amr, Ehab, Gamal, Hesham, Kareem, Magdy, Nader, Osama, Ramy, Sameh, Yehia, Waheed, Ibrahim`),
    surnames: list(`Elsayed, Fathy, Gaber, Hamdy, Lotfy, Naguib, Ramzy, Selim, Tawfik, Wahba, Younan, El-Shamy, Bishara, Dawood, Fahmy, Ghobrial, Habashy, Iskandar, Kamel, Labib, Mikhail, Nosseir, Refaat, Shenouda, Tadros, El-Masry, Mansy, Zakaria, Abdelnour, Soliman`),
  },
  {
    culture: 'arab',
    group: 'maghrebi',
    women: list(`Amal, Souad, Leila, Samira, Houda, Imane, Latifa, Meriem, Naima, Rajae, Saida, Wafa, Yasmine, Zahra, Asmaa, Bouchra, Kenza, Nadia, Fatima, Zineb`),
    men: list(`Yassine, Mehdi, Anouar, Driss, Hamid, Jamal, Khalil, Mourad, Nadir, Rachid, Said, Tarik, Zouhair, Adil, Cherif, Fouad, Hakim, Larbi, Amine, Reda`),
    surnames: list(`Benali, El-Amrani, Bennani, Cherkaoui, Idrissi, Alaoui, Fassi, Tazi, Berrada, Lahlou, Kettani, Bensouda, Chraibi, Filali, Guessous, Hajji, Kadiri, Lamrani, Mansouri, Naciri, Ouazzani, Rahmouni, Saidi, Tahiri, Zniber, Belkacem, Hamdi, Jabri, Karimi, Lazrak, Mekouar, Nejjar, Rahali, Sbihi, Tlemcani, Ziani, Bennis, Squalli, Chafik, El-Fassi`),
  },
  {
    culture: 'arab',
    group: 'gulf',
    women: list(`Mouza, Shaikha, Hind, Alanoud, Alya, Hessa, Maitha, Rawdha, Shamsa, Wadha, Noura, Fatma, Latifa, Maryam, Zainab`),
    men: list(`Rashid, Sultan, Hamdan, Majid, Nasser, Saif, Thamer, Abdullah, Badr, Hasher, Jassim, Khalifa, Obaid, Qassim, Saud, Theyab, Zayed, Faisal, Hamad, Mana`),
    surnames: list(`Al-Farsi, Al-Mutairi, Al-Dosari, Al-Harthy, Al-Balushi, Al-Suwaidi, Al-Mazrouei, Al-Kaabi, Al-Shamsi, Al-Mansoori, Al-Nuaimi, Al-Dhaheri, Al-Ketbi, Al-Muhairi, Al-Zaabi, Al-Hosani, Al-Qasimi, Al-Kuwari, Al-Attiyah, Al-Subaie, Al-Otaibi, Al-Ghamdi, Al-Zahrani, Al-Shehri, Al-Qahtani, Al-Harbi, Al-Anazi, Al-Dossari, Al-Ajmi, Al-Rashidi`),
  },
  {
    culture: 'african',
    group: 'yoruba',
    women: list(`Adeola, Funke, Yetunde, Bisola, Titilayo, Abosede, Folake, Iyabo, Kehinde, Modupe, Omolara, Shade, Tosin, Wuraola, Yewande, Adenike, Bolanle, Damilola, Eniola, Folasade`),
    men: list(`Adebayo, Olumide, Babajide, Oluwaseun, Tunde, Kayode, Lanre, Segun, Wale, Yinka, Adewale, Babatunde, Femi, Gbenga, Kunle, Lekan, Seyi, Tobi, Dele, Jide`),
    surnames: list(`Adeyemi, Adebisi, Balogun, Ogunleye, Oladipo, Afolabi, Ojo, Adekunle, Olatunji, Adenuga, Bakare, Falana, Adesina, Ajayi, Ogunyemi, Adeleke, Bankole, Akinyemi, Adegoke, Famuyiwa, Ogunsola, Adesanya, Ogunjobi, Akinola, Olatunde, Banjo, Ogunmola, Adepoju, Adefemi, Ogunrinde`),
  },
  {
    culture: 'african',
    group: 'igbo',
    women: list(`Adaeze, Chioma, Ngozi, Ifeoma, Amaka, Chiamaka, Ogechi, Nneka, Oluchi, Chidinma, Adaora, Chinyere, Ebere, Ifunanya, Nkem, Obiageli, Uchechi, Nkiru, Chisom, Uju`),
    men: list(`Chinedu, Obinna, Ikenna, Chukwudi, Emeka, Nnamdi, Kelechi, Uche, Chibueze, Azubuike, Chuka, Ifeanyi, Lotanna, Nonso, Okey, Somto, Chima, Jideofor, Ugochukwu, Chibuike`),
    surnames: list(`Okeke, Nwosu, Eze, Okafor, Okoro, Nwankwo, Nnamani, Okoye, Ugwu, Onwudiwe, Anyanwu, Okorie, Okpala, Nnaji, Chukwu, Ibe, Madu, Nwachukwu, Okoli, Ekwueme, Anozie, Dike, Igbokwe, Nwabueze, Onyekwere, Ubah, Agu, Igwe, Nduka, Okpara, Umeh, Chukwuma, Ezeoke, Onyeka`),
  },
  {
    culture: 'african',
    group: 'akan',
    women: list(`Akua, Abena, Ama, Efua, Adwoa, Yaa, Afia, Akosua, Aba, Araba, Esi, Maame, Adjoa, Kukua, Obaapa`),
    men: list(`Kwame, Kofi, Kwesi, Kojo, Yaw, Kwabena, Fiifi, Kweku, Yoofi, Ebo, Kodwo, Kwaku, Panyin, Nana, Kobby`),
    surnames: list(`Mensah, Boateng, Owusu, Asante, Agyeman, Appiah, Darko, Frimpong, Opoku, Amoako, Antwi, Bonsu, Danso, Gyasi, Ofori, Poku, Quaye, Sarpong, Yeboah, Adu, Boakye, Donkor, Essien, Fosu, Gyamfi, Kissi, Lartey, Manu, Nyarko, Osei, Safo, Prempeh, Cudjoe, Tutu, Baah`),
  },
  {
    culture: 'african',
    group: 'kikuyu',
    women: list(`Wanjiku, Nyambura, Wairimu, Njeri, Nyokabi, Wambui, Wangari, Mukami, Wanja, Njoki`),
    men: list(`Kamau, Mwangi, Kariuki, Kimani, Njoroge, Waweru, Maina, Njenga, Gitau, Karanja`),
    surnames: list(`Kariuki, Kimani, Mwangi, Njoroge, Waweru, Maina, Njenga, Gitau, Karanja, Kamau, Ndung'u, Wachira, Githinji, Mbugua, Ngugi, Kinyua, Muchiri, Ndegwa, Wanjohi, Irungu`),
  },
  {
    culture: 'african',
    group: 'luo',
    women: list(`Achieng, Atieno, Akinyi, Awino, Adhiambo, Anyango, Aoko, Apiyo, Awuor, Akoth`),
    men: list(`Otieno, Omondi, Odhiambo, Owuor, Okoth, Onyango, Owino, Ochieng, Oloo, Ogola`),
    surnames: list(`Otieno, Omondi, Odhiambo, Owuor, Okoth, Onyango, Owino, Ochieng, Oloo, Ogola, Ouma, Okello, Opiyo, Oduor, Ojwang, Okumu, Omollo, Were, Awiti, Oduya`),
  },
  {
    culture: 'african',
    group: 'amhara',
    women: list(`Meron, Selam, Bethlehem, Hana, Tigist, Mekdes, Rahel, Yordanos, Frehiwot, Hirut`),
    men: list(`Dawit, Yonas, Abel, Bereket, Henok, Nahom, Robel, Tesfaye, Yonatan, Samuel`),
    surnames: list(`Bekele, Alemu, Tadesse, Gebre, Haile, Kebede, Assefa, Desta, Girma, Worku, Abebe, Mulugeta, Negussie, Belay, Demissie, Fikru, Getachew, Hailu, Mengistu, Tesfaye`),
  },
  {
    culture: 'african',
    group: 'nguni',
    women: list(`Thandi, Nompumelelo, Zanele, Nomsa, Lindiwe, Busisiwe, Nonhlanhla, Sindiswa, Nomvula, Thandeka`),
    men: list(`Sipho, Thabo, Mandla, Sibusiso, Bongani, Lungelo, Andile, Khulekani, Jabulani, Thembinkosi`),
    surnames: list(`Dlamini, Nkosi, Khumalo, Ndlovu, Mkhize, Zulu, Cele, Buthelezi, Mthembu, Ntuli, Zungu, Sithole, Tshabalala, Mokoena, Radebe, Hlongwane, Khoza, Mabaso, Mahlangu, Skosana`),
  },
  {
    culture: 'african',
    group: 'somali',
    women: list(`Hodan, Fartun, Sahra, Ubax, Hamdi, Ikran, Jawahir, Khadra, Canab, Nasteho`),
    men: list(`Abdi, Liban, Guled, Abdirahman, Farah, Ismail, Jama, Mohamed, Abdullahi, Yusuf`),
    surnames: list(`Warsame, Hirsi, Elmi, Aden, Roble, Dualeh, Barre, Noor, Osman, Ali, Farah, Hassan, Ibrahim, Ahmed, Omar, Said, Gulled, Jama, Mohamed, Abdullahi`),
  },
  {
    culture: 'east-asian',
    group: 'chinese',
    women: list(`Mei, Xiaowen, Fang, Jing, Hui, Yan, Qing, Lan, Hong, Na, Ying, Xue, Min, Juan, Ping, Shu, Yun, Zhen, Ai, Bing, Lihua, Xiaoli, Wenjing, Yating, Huimin`),
    men: list(`Wei, Jun, Hao, Lei, Tao, Bo, Peng, Qiang, Gang, Chao, Feng, Jian, Ming, Rong, Sheng, Xiang, Yong, Zhi, Dong, Kai, Bin, Cheng, De, Guang, Huiwei`),
    surnames: list(`Chen, Wang, Li, Zhang, Liu, Yang, Huang, Zhao, Wu, Zhou, Xu, Sun, Ma, Zhu, Hu, Guo, He, Lin, Luo, Gao, Zheng, Liang, Xie, Tang, Deng, Cao, Yuan, Pan, Du, Cai, Jiang, Cui, Shen, Lu, Tan, Kong, Wan, Gu, Qin, Hou, Shao, Meng, Bai, Shi, Yao, Jin, Duan, Qian, Qiu, Mao, Gong, Xia`),
  },
  {
    culture: 'east-asian',
    group: 'japanese',
    women: list(`Yui, Aoi, Hina, Sakura, Yuna, Rina, Mio, Aya, Hana, Keiko, Yoko, Naomi, Tomoko, Akiko, Emi, Haruka, Kana, Mai, Nanami, Misaki`),
    men: list(`Haruto, Minato, Sota, Yuto, Kenji, Daiki, Takumi, Ren, Hiroshi, Kazuki, Shota, Kenta, Naoki, Ryo, Tsubasa, Yuji, Akira, Daisuke, Kohei, Makoto`),
    surnames: list(`Sato, Suzuki, Takahashi, Tanaka, Watanabe, Ito, Yamamoto, Nakamura, Kobayashi, Saito, Kato, Yoshida, Yamada, Sasaki, Yamaguchi, Matsumoto, Inoue, Kimura, Hayashi, Shimizu, Yamazaki, Mori, Abe, Ikeda, Hashimoto, Yamashita, Ishikawa, Nakajima, Maeda, Fujita, Ogawa, Goto, Okada, Hasegawa, Murakami, Kondo, Ishii, Sakamoto, Endo, Aoki`),
  },
  {
    culture: 'east-asian',
    group: 'korean',
    women: list(`Seo-yeon, Ji-woo, Min-ji, Soo-jin, Hye-jin, Eun-ji, Yeon-woo, Ha-eun, Su-bin, Ye-jin, Da-eun, Bo-ra, Chae-won, Eun-seo, Ga-eun, Hye-won, Jung-ah, Kyung-mi, So-young, Hae-won`),
    men: list(`Min-jun, Seo-jun, Do-yoon, Ji-ho, Hyun-woo, Jun-seo, Si-woo, Ye-jun, Gun-woo, Woo-jin, Jae-won, Sung-min, Tae-hyun, Young-ho, Chan-woo, Dong-hyun, Ho-jun, Gi-tae, Byung-ho, Eun-seok`),
    surnames: list(`Kim, Lee, Park, Choi, Jung, Kang, Cho, Yoon, Jang, Lim, Shin, Oh, Seo, Kwon, Hwang, Ahn, Hong, Yoo, Ko, Moon, Bae, Baek, Heo, Nam, Noh, Ha, Kwak, Sung, Jeon, Ryu, Sim, Son, Chae, Gil, Ban, Byun, Cheon, Yeo, Im, Woo, Pyo, Tak`),
  },
  {
    culture: 'eastern-european',
    group: 'polish',
    women: list(`Anna, Katarzyna, Agnieszka, Magdalena, Joanna, Monika, Barbara, Ewa, Malgorzata, Aleksandra, Natalia, Karolina, Marta, Dorota, Beata, Iwona, Justyna, Paulina, Weronika, Zuzanna`),
    men: list(`Piotr, Krzysztof, Andrzej, Tomasz, Pawel, Michal, Marcin, Jakub, Adam, Lukasz, Grzegorz, Marek, Rafal, Wojciech, Dariusz, Sebastian, Kamil, Mateusz, Dawid, Bartosz`),
    surnames: list(``),
    womenSurnames: list(`Kowalska, Wisniewska, Kaminska, Lewandowska, Zielinska, Szymanska, Dabrowska, Kozlowska, Jankowska, Wojciechowska, Kwiatkowska, Piotrowska, Grabowska, Pawlowska, Michalska, Jablonska, Nowicka, Majewska, Olszewska, Malinowska`),
    menSurnames: list(`Nowak, Mazur, Wozniak, Kaczmarek, Wieczorek, Krol, Wrobel, Stepien, Adamczyk, Dudek, Walczak, Sikora, Baran, Pietrzak, Marciniak, Szewczyk, Michalak, Bak, Wlodarczyk, Lis`),
  },
  {
    culture: 'eastern-european',
    group: 'ukrainian',
    women: list(`Olena, Nataliia, Tetiana, Iryna, Oksana, Halyna, Lesia, Svitlana, Yuliia, Kateryna`),
    men: list(`Oleksandr, Andrii, Mykola, Vasyl, Serhii, Dmytro, Bohdan, Taras, Yurii, Roman`),
    surnames: list(`Shevchenko, Kovalenko, Bondarenko, Tkachenko, Kravchenko, Oliinyk, Shevchuk, Melnyk, Kovalchuk, Savchenko, Polishchuk, Lysenko, Marchenko, Rudenko, Petrenko`),
  },
  {
    culture: 'eastern-european',
    group: 'czech',
    women: list(`Tereza, Eliska, Adela, Natalie, Viktorie, Barbora, Kristyna, Klara, Lucie, Veronika, Alzbeta, Anezka`),
    men: list(`Jan, Petr, Josef, Pavel, Martin, Tomas, Jaroslav, Miroslav, Frantisek, Jiri, Lukas, Ondrej`),
    surnames: list(``),
    womenSurnames: list(`Novakova, Svobodova, Novotna, Dvorakova, Cerna, Prochazkova, Kucerova, Vesela, Horakova, Nemcova, Markova, Pokorna`),
    menSurnames: list(`Jelinek, Hajek, Kral, Ruzicka, Benes, Fiala, Sedlacek, Dolezal, Krejci, Navratil, Cermak, Blazek`),
  },
  {
    culture: 'eastern-european',
    group: 'slovak',
    women: list(`Zuzana, Lucia, Martina, Nikola, Simona, Michaela, Lenka, Denisa`),
    men: list(`Marek, Peter, Jozef, Ladislav, Stefan, Robert, Patrik, Samuel`),
    surnames: list(``),
    womenSurnames: list(`Horvathova, Kovacova, Vargova, Tothova, Balazova, Molnarova, Lukacova, Krajciova`),
    menSurnames: list(`Polak, Urban, Sykora, Oravec, Simko, Masar, Chudy, Krajci`),
  },
  {
    culture: 'eastern-european',
    group: 'hungarian',
    women: list(`Katalin, Erzsebet, Ilona, Eva, Zsuzsanna, Andrea, Krisztina, Agnes, Eszter, Viktoria`),
    men: list(`Laszlo, Istvan, Gabor, Zoltan, Attila, Tamas, Ferenc, Jozsef, Balazs, Gergely`),
    surnames: list(`Nagy, Kovacs, Szabo, Varga, Kiss, Molnar, Nemeth, Farkas, Balogh, Papp, Takacs, Juhasz, Lakatos, Meszaros, Olah, Racz, Fekete, Sipos, Kocsis, Bodnar`),
  },
  {
    culture: 'eastern-european',
    group: 'romanian',
    women: list(`Elena, Ioana, Maria, Andreea, Alexandra, Gabriela, Mihaela, Cristina, Ana, Raluca`),
    men: list(`Andrei, Alexandru, Mihai, Ionut, Constantin, Florin, Adrian, Radu, Bogdan, Vlad`),
    surnames: list(`Popa, Popescu, Ionescu, Dumitru, Stan, Stoica, Gheorghe, Matei, Ciobanu, Munteanu, Rusu, Moldovan, Luca, Barbu, Dinu, Ene, Florea, Grigore, Ilie, Marin`),
  },
  {
    culture: 'eastern-european',
    group: 'bulgarian',
    women: list(`Gergana, Desislava, Ivanka, Nadezhda, Petya, Rositsa, Silvia, Teodora, Elena, Maria`),
    men: list(`Georgi, Ivan, Dimitar, Nikolay, Petar, Stefan, Hristo, Krasimir, Lyubomir, Todor`),
    surnames: list(``),
    womenSurnames: list(`Ivanova, Georgieva, Dimitrova, Petrova, Nikolova, Stoyanova, Todorova, Hristova, Angelova, Koleva`),
    menSurnames: list(`Markov, Vasilev, Iliev, Atanasov, Yordanov, Kostov, Pavlov, Mihaylov, Kirilov, Stefanov`),
  },
  {
    culture: 'eastern-european',
    group: 'lithuanian',
    women: list(`Austeja, Gabija, Emilija, Ugne, Liepa, Migle, Ieva, Rasa`),
    men: list(`Jonas, Mantas, Lukas, Dominykas, Matas, Nojus, Andrius, Tadas`),
    surnames: list(``),
    womenSurnames: list(`Kazlauskiene, Jankauskiene, Petrauskiene, Stankeviciene, Vasiliauskiene, Navickiene, Zukauskiene, Butkiene`),
    menSurnames: list(`Balciunas, Paulauskas, Urbonas, Sadauskas, Mockus, Petrauskas, Navickas, Jankauskas`),
  },
]
